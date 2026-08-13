import { SqlQuery, type SqlQueryAny } from "#src/core/query/sql-query.js";
import { SqlRunError } from "#src/core/sql-run-error.js";
import { SqlErrorCode } from "#src/core/sql-error-code.js";
import { SchemaGraph, type JoinType } from "#src/execution/execution.js";
import { SqlQueryRegistry } from "#src/execution/sql-query-registry.js";
import type { VexnorPluginAny } from "#src/plugin/vexnor-plugin.js";
import type { SchemaCatalog } from "#src/schema/schema-catalog.js";
import type { SchemaSelectionScope } from "#src/schema/schema-selection.js";
import { createRuntimeSchemaMappings, type RuntimeSchemaMappings } from "#src/schema/runtime-schema-mappings.js";
import {
   InvalidLocalQueryParametersError,
   LocalDataSessionBudgetError,
   LocalDataSessionCancellationError,
   LocalDataSessionClosedError,
   LocalDataSessionTimeoutError,
   MissingRelationshipPathError,
   SchemaConfigurationError,
} from "#src/schema/schema-errors.js";

export type LocalDataSessionLimits = {
   maxRows: number;
   timeoutMs: number;
   maxConcurrency: number;
};

export type LocalDataSessionConnection = {
   readonly db: unknown;
   close(): Promise<void>;
};

export type LocalDataQueryDescriptor = {
   objectIds: string[];
   name: string;
   plugin: string;
   hash: string;
   columns: string[];
   kind: "read" | "join";
};

export type LocalDataJoinResult = LocalDataQueryDescriptor & {
   joinBy: Record<string, { on: [string, string, string][]; type?: JoinType }>;
};

export type LocalDataFetchRequest = {
   plugin: string;
   hash: string;
   params: Record<string, unknown>;
};

type RegisteredLocalQuery = LocalDataQueryDescriptor & {
   query: SqlQueryAny;
};

export class LocalDataSession {
   readonly registry: SqlQueryRegistry;
   readonly graph: SchemaGraph;
   readonly mappings: RuntimeSchemaMappings;
   private readonly registered = new Map<string, RegisteredLocalQuery>();
   private readonly abortListener: (() => void) | null;
   private closed = false;
   private closePromise: Promise<void> | null = null;

   private constructor(
      readonly plugin: VexnorPluginAny,
      private readonly connection: LocalDataSessionConnection,
      readonly catalog: SchemaCatalog,
      readonly selection: SchemaSelectionScope,
      readonly limits: LocalDataSessionLimits,
      private readonly signal?: AbortSignal,
   ) {
      this.registry = new SqlQueryRegistry({
         strictParams: true,
         maxConcurrent: limits.maxConcurrency,
      });
      this.mappings = createRuntimeSchemaMappings({ catalog, selection });
      this.graph = new SchemaGraph(this.mappings.schema, { include: "all-readable", plugin });
      this.abortListener = signal
         ? () => {
              void this.close();
           }
         : null;
      if (this.abortListener) signal!.addEventListener("abort", this.abortListener, { once: true });
   }

   static async create(args: {
      plugin: VexnorPluginAny;
      connection: LocalDataSessionConnection;
      catalog: SchemaCatalog;
      selection: SchemaSelectionScope;
      limits: LocalDataSessionLimits;
      signal?: AbortSignal;
   }): Promise<LocalDataSession> {
      validateLimits(args.limits);
      const session = new LocalDataSession(
         args.plugin,
         args.connection,
         args.catalog,
         args.selection,
         args.limits,
         args.signal,
      );
      if (args.signal?.aborted) {
         await session.close();
         throw new LocalDataSessionCancellationError("Local data session creation was cancelled");
      }
      await session.registerReadQueries();
      return session;
   }

   get queries(): LocalDataQueryDescriptor[] {
      return [...this.registered.values()]
         .map(({ query: _query, ...descriptor }) => descriptor)
         .sort((left, right) => left.name.localeCompare(right.name));
   }

   async registerJoin({
      from,
      targets,
   }: {
      from: string;
      targets: Array<{ table: string; type?: JoinType }>;
   }): Promise<LocalDataJoinResult> {
      this.assertOpen();
      const result = this.graph.joinBy(from, targets);
      if (!result) {
         throw new MissingRelationshipPathError(`No known selected relationship path from ${from} to ${targets.map((target) => target.table).join(", ")}`);
      }
      if (!(result.query instanceof SqlQuery)) {
         throw new MissingRelationshipPathError("Resolved relationship path did not produce a Vexnor query");
      }
      const hash = await result.query.hash;
      const descriptor: RegisteredLocalQuery = {
         objectIds: result.tables,
         name: `join_${hash.slice(0, 16)}`,
         plugin: this.plugin.name,
         hash,
         columns: result.columns,
         kind: "join",
         query: result.query,
      };
      if (!this.registered.has(hash)) {
         await this.registry.register(this.plugin, { [descriptor.name]: result.query });
         this.registered.set(hash, descriptor);
      }
      return { ...this.publicDescriptor(descriptor), joinBy: result.joinBy };
   }

   async fetchData(request: LocalDataFetchRequest): Promise<unknown> {
      this.assertOpen();
      if (request.plugin !== this.plugin.name) {
         throw new InvalidLocalQueryParametersError(`Unknown local data plugin: ${request.plugin}`);
      }
      const registered = this.registered.get(request.hash);
      if (!registered) throw new InvalidLocalQueryParametersError(`Unknown local data query hash: ${request.hash}`);
      if (!isRecord(request.params)) throw new InvalidLocalQueryParametersError("Local data query params must be an object");
      const params = this.validateAndLimitParams(registered.query, request.params);

      try {
         const execution = this.registry.execute(
            {
               plugin: this.plugin.name,
               hash: registered.hash,
               params,
               mode: "read",
               location: null,
               name: registered.name,
               options: { timeout: this.limits.timeoutMs },
            },
            async () => this.connection,
         );
         return await this.withCancellation(execution);
      } catch (error) {
         if (error instanceof SqlRunError && error.code === SqlErrorCode.QUERY_TIMEOUT) {
            await this.close();
            throw new LocalDataSessionTimeoutError(`Local data query exceeded the ${this.limits.timeoutMs}ms session timeout`);
         }
         if (error instanceof SqlRunError && error.code === SqlErrorCode.QUERY_RATE_LIMITED) {
            throw new LocalDataSessionBudgetError(`Local data session concurrency limit reached: ${this.limits.maxConcurrency}`);
         }
         if (this.signal?.aborted) throw new LocalDataSessionCancellationError("Local data query was cancelled");
         throw error;
      }
   }

   async fetchRows(request: LocalDataFetchRequest): Promise<unknown[]> {
      const registered = this.registered.get(request.hash);
      if (!registered) throw new InvalidLocalQueryParametersError(`Unknown local data query hash: ${request.hash}`);
      const result = await this.fetchData(request);
      if (!isRecord(result)) throw new InvalidLocalQueryParametersError("Local data query result must be an object");
      return this.plugin.newQueryHandler(registered.query).resolveRows(result);
   }

   async close(): Promise<void> {
      if (this.closePromise) return this.closePromise;
      this.closed = true;
      if (this.abortListener && this.signal) this.signal.removeEventListener("abort", this.abortListener);
      this.closePromise = this.connection.close();
      return this.closePromise;
   }

   private async registerReadQueries(): Promise<void> {
      for (const mapping of this.mappings.mappings) {
         const query = this.plugin.newSelectQuery(mapping.table);
         const hash = await query.hash;
         const descriptor: RegisteredLocalQuery = {
            objectIds: [mapping.id],
            name: `read_${sanitizeName(mapping.id)}`,
            plugin: this.plugin.name,
            hash,
            columns: [...mapping.table.colKeys],
            kind: "read",
            query,
         };
         await this.registry.register(this.plugin, { [descriptor.name]: query });
         this.registered.set(hash, descriptor);
      }
   }

   private validateAndLimitParams(query: SqlQueryAny, params: Record<string, unknown>): Record<string, unknown> {
      const allowed = new Set(Object.keys(query.params ?? {}));
      const unknown = Object.keys(params).filter((key) => !allowed.has(key));
      if (unknown.length > 0) {
         throw new InvalidLocalQueryParametersError(`Unknown local data query parameters: ${unknown.sort().join(", ")}`);
      }
      const requestedLimit = params.limit;
      if (requestedLimit !== undefined && (!Number.isInteger(requestedLimit) || Number(requestedLimit) < 1)) {
         throw new InvalidLocalQueryParametersError("Local data query limit must be a positive integer");
      }
      return { ...params, limit: Math.min(requestedLimit === undefined ? this.limits.maxRows : Number(requestedLimit), this.limits.maxRows) };
   }

   private async withCancellation<T>(execution: Promise<T>): Promise<T> {
      if (!this.signal) return execution;
      if (this.signal.aborted) throw new LocalDataSessionCancellationError("Local data query was cancelled");
      let listener: (() => void) | undefined;
      const cancellation = new Promise<never>((_resolve, reject) => {
         listener = () => reject(new LocalDataSessionCancellationError("Local data query was cancelled"));
         this.signal!.addEventListener("abort", listener, { once: true });
      });
      try {
         return await Promise.race([execution, cancellation]);
      } finally {
         if (listener) this.signal.removeEventListener("abort", listener);
      }
   }

   private publicDescriptor({ query: _query, ...descriptor }: RegisteredLocalQuery): LocalDataQueryDescriptor {
      return descriptor;
   }

   private assertOpen(): void {
      if (this.signal?.aborted) throw new LocalDataSessionCancellationError("Local data session was cancelled");
      if (this.closed) throw new LocalDataSessionClosedError("Local data session is closed");
   }
}

export async function createLocalDataSession(args: {
   plugin: VexnorPluginAny;
   connection: LocalDataSessionConnection;
   catalog: SchemaCatalog;
   selection: SchemaSelectionScope;
   limits: LocalDataSessionLimits;
   signal?: AbortSignal;
}): Promise<LocalDataSession> {
   return LocalDataSession.create(args);
}

function validateLimits(limits: LocalDataSessionLimits): void {
   for (const [name, value] of Object.entries(limits)) {
      if (!Number.isInteger(value) || value < 1) throw new SchemaConfigurationError(`Local data session ${name} must be a positive integer`);
   }
}

function sanitizeName(id: string): string {
   return id.replace(/[^a-zA-Z0-9]+/g, "_");
}

function isRecord(value: unknown): value is Record<string, unknown> {
   return typeof value === "object" && value !== null && !Array.isArray(value);
}

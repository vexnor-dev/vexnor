import { SqlQueryBase, SqlQueryBaseAny, SqlQuery, SqlQueryColumns } from "#/core/query/sql-query.js";
import { ok } from "#/lib/assert.js";
import { isRemoteClient, QueryMeta, SqlExecuteMode, SqlQueryRunArgs, SqlRunArgs } from "#/core/query/sql-query-types.js";
import { SqlRunError } from "#/core/sql-run-error.js";
import { SqlErrorCode } from "#/core/sql-error-code.js";
import { setQueryMeta, getQueryMeta } from "#/core/query/query-meta-store.js";
import type { SqlJsonSchema } from "#/core/utils/sql-json-schema.js";
import { deserialize } from "#/core/utils/sql-json-schema.js";
import { isContextValue } from "#/core/query/context-value.js";
import { isVexnorConnection } from "#/plugin/vexnor-connection.js";
import type { SqlPipelineExecutionArgs } from "#/execution/sql-query-pipeline-plugin.js";
import { runWithRetry } from "#/core/query/sql-retry.js";
import { getQueryName } from "#/core/query/sql-query-name.js";
import { ARGS, PARAMS, QUERY, Sql, TYPE } from "#/core/sql-base.js";
import { SqlBuildContext } from "#/core/builder/sql-build-context.js";
import { SqlBuildOptions } from "#/core/builder/sql-build-options.js";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type SqlQueryHandlerAny = SqlQueryHandler<any>;

/**
 * Base query handler for async database operations
 */
export abstract class SqlQueryHandler<
   T extends { Row?: unknown; Params?: unknown; Read: object; Write: object; Connection: unknown },
>
   extends Sql
   implements SqlQueryBase<Pick<T, "Params" | "Row">>
{
   declare readonly [QUERY]: SqlQuery<Pick<T, "Row" | "Params">>;
   declare readonly [TYPE]: T["Row"];
   declare readonly [PARAMS]: T["Params"];
   declare readonly [ARGS]: T["Params"];

   readonly pluginName: string;
   readonly rowSchemas = new Map<boolean, SqlJsonSchema>();

   protected constructor(
      public readonly source: SqlQuery<Pick<T, "Row" | "Params">>,
      { pluginName }: { pluginName: string },
   ) {
      super(source);
      this.pluginName = pluginName;
   }

   write<T>(context: SqlBuildContext, options?: SqlBuildOptions | null, scope?: T | null) {
      this.source.write(context, options, scope);
   }

   get jsonSchema(): SqlJsonSchema {
      return this.source.jsonSchema;
   }

   /**
    * Getter method to retrieve the type of the row.
    *
    * @return T["Row"] The type definition for the row.
    */
   get rowType(): T["Row"] {
      throw new Error("this property is only for fetching the row type");
   }

   abstract resolveRows(res: T["Read"]): T["Row"][];

   /**
    * Executes the query and returns the raw QueryResult without deserialized rows.
    */
   abstract execute(
      args: SqlRunArgs<Pick<T, "Connection" | "Params">>,
      mode?: SqlExecuteMode,
      meta?: QueryMeta,
   ): Promise<typeof mode extends "write" ? T["Write"] : T["Read"]>;

   /**
    * Returns the JSON schema for the query result rows, with optional filtering for remote execution.
    *
    * For remote execution, all fields are included (including top-level Date strings).
    * For local execution, only nested object/array fields are included (top-level Date fields are already Date instances).
    * @param isRemoteClient
    */
   getRowSchema(isRemoteClient: boolean) {
      if (this.rowSchemas.has(isRemoteClient)) return this.rowSchemas.get(isRemoteClient)!;

      const schema = this.jsonSchema;
      const result: SqlJsonSchema = isRemoteClient
         ? schema
         : Object.fromEntries(Object.entries(schema).filter(([, v]) => typeof v !== "string"));
      this.rowSchemas.set(isRemoteClient, result);
      return result;
   }

   /**
    * Deserializes rows based on local vs remote execution context.
    * Local: only deserializes nested object/array fields (top-level Date fields are already Date instances from the driver).
    * Remote: deserializes all fields including top-level Date strings.
    */
   deserializeRows(rows: T["Row"][], remote: boolean): T["Row"][] {
      const schema = this.jsonSchema;
      if (!Object.keys(schema).length) {
         return rows;
      }

      const filteredSchema: SqlJsonSchema = remote
         ? schema
         : Object.fromEntries(Object.entries(schema).filter(([, v]) => typeof v !== "string"));

      if (!Object.keys(filteredSchema).length) return rows;

      return rows.map((row) => deserialize(row, filteredSchema));
   }

   /**
    * Override in plugin handlers to deserialize rows and recompose into the native result shape.
    * @param result
    * @param isRemoteClient
    */
   abstract deserialize(result: T["Read"], isRemoteClient: boolean): T["Read"];

   serialize(value: T["Read"]): T["Read"] {
      return value;
   }

   isReadResult(result: unknown): result is T["Read"] {
      return typeof result === "object" && result !== null && "rows" in result && Array.isArray(result.rows);
   }

   // Helper type: the bound for TContext on public methods
   declare private readonly _params: T["Params"] extends Record<string, unknown>
      ? T["Params"]
      : Record<string, unknown>;

   /**
    * Executes the query, deserializes the result, and returns the raw QueryResult with deserialized rows.
    */
   async run<TContext extends typeof this._params>(
      args: SqlQueryRunArgs<Pick<T, "Connection" | "Params">, TContext>,
      mode: SqlExecuteMode = "read",
   ): Promise<typeof mode extends "write" ? T["Write"] : T["Read"]> {
      const { db } = args;

      const resolvedDb = await db;
      const name = (await getQueryName(this.source)) ?? this.source.info?.label ?? this.source.id;

      if (isRemoteClient(resolvedDb)) {
         const hash = await this.source.hash;
         const rawParams = this.getInputParams(args);
         // Strip runtimeValue sentinels — these are injected server-side from registry context
         const params = Object.fromEntries(Object.entries(rawParams).filter(([, v]) => !isContextValue(v)));
         return await resolvedDb
            .remoteExecute<T["Write"]>({
               plugin: this.pluginName,
               hash,
               params,
               name,
               location: this.source.location,
               mode,
               options: args.options,
               meta: args.options?.meta,
            })
            .then((data) => {
               if (!this.isReadResult(data)) return data;

               return this.deserialize(data, true);
            });
      }

      if (isVexnorConnection(resolvedDb)) {
         const rawDb = resolvedDb.db;
         if (resolvedDb.pipeline) {
            const params = this.getInputParams(args);
            const executionArgs: SqlPipelineExecutionArgs = {
               plugin: { name: this.pluginName },
               query: this.source,
               name,
               params,
               mode,
               remote: null,
               context: this.source.getContext(args.params),
            };

            return await resolvedDb.pipeline.execute(
               executionArgs,
               () =>
                  runWithRetry(args.options?.retry, undefined, () =>
                     this.runLocal({ ...args, db: rawDb } as SqlRunArgs<Pick<T, "Connection" | "Params">>, mode),
                  ),
               args.options,
            ).then(data => {
               return this.serialize(data);
            });
         }

         return this.serialize(await runWithRetry(args.options?.retry, undefined, () =>
            this.runLocal({ ...args, db: rawDb } as SqlRunArgs<Pick<T, "Connection" | "Params">>, mode),
         ));
      }

      return this.serialize(await runWithRetry(args.options?.retry, undefined, () =>
         this.runLocal({ ...args, db: resolvedDb } as SqlRunArgs<Pick<T, "Connection" | "Params">>, mode),
      ));
   }

   async runLocal(
      args: SqlRunArgs<Pick<T, "Connection" | "Params">>,
      mode: SqlExecuteMode = "read",
   ): Promise<typeof mode extends "write" ? T["Write"] : T["Read"]> {
      const { options } = args;
      const { timeout, retryable: retryableOption } = options ?? {};
      const meta: QueryMeta = options?.meta ?? {};
      const queryName = (await getQueryName(this.source)) ?? this.source.info?.label ?? this.source.id;

      try {
         const start = performance.now();
         let execution = this.execute(args, mode, meta);
         if (timeout) {
            execution = withTimeout(
               execution,
               timeout,
               () =>
                  new SqlRunError(`Query timed out after ${timeout}ms`, this.source, {
                     code: SqlErrorCode.QUERY_TIMEOUT,
                     queryName,
                  }),
            );
         }

         return await execution.then((data) => {
            meta.duration = performance.now() - start;
            const result = this.isReadResult(data) ? this.deserialize(data, false) : data;
            setQueryMeta(result, meta);
            return result;
         });
      } catch (err) {
         if (err instanceof SqlRunError) {
            throw retryableOption !== undefined && retryableOption !== "default"
               ? err.withOptions({ retryable: retryableOption })
               : err;
         }

         throw new SqlRunError(`Error executing sql query '${this.id}'`, this.source, {
            cause: err,
            queryName: this.source.info?.label ?? undefined,
            code: SqlErrorCode.QUERY_EXECUTION_FAILED,
            retryable: resolveRetryable(false, retryableOption),
         });
      }
   }

   private getInputParams(args: SqlQueryRunArgs<Pick<T, "Connection" | "Params">, never>): Record<string, unknown> {
      return (args as { params?: Record<string, unknown> }).params ?? {};
   }

   /**
    * Executes the query and returns exactly one row.
    *
    * Throws if the result contains zero rows or more than one row.
    *
    * @param args - Database connection and query parameters.
    */
   async one<TContext extends typeof this._params>(
      args: SqlQueryRunArgs<Pick<T, "Connection" | "Params">, TContext>,
   ): Promise<T["Row"]> {
      const rows = await this.all(args);
      ok(rows.length === 1, `Expected one row, actual is ${rows.length} rows.`);
      const row = rows[0];
      ok(row, `The one row in result is not defined: ${row}`);

      return row;
   }

   /**
    * Executes the query and returns the first row.
    * Throws if the result contains zero rows.
    * @param args - Database connection and query parameters.
    */
   async first<TContext extends typeof this._params>(
      args: SqlQueryRunArgs<Pick<T, "Connection" | "Params">, TContext>,
   ): Promise<T["Row"] | undefined> {
      const rows = await this.all(args);
      if (!rows?.length) return undefined;

      return rows[0]!;
   }

   /**
    * Executes the query and returns the first row, or `undefined` if no rows are found.
    *
    * @param args - Database connection and query parameters.
    */
   async any<TContext extends typeof this._params>(
      args: SqlQueryRunArgs<Pick<T, "Connection" | "Params">, TContext>,
   ): Promise<T["Row"] | undefined> {
      const rows = await this.all(args);
      if (!rows?.length) return undefined;

      return rows[0]!;
   }

   //TODO: refactor this, make serialize / deserialize and integrate it already in the query execution

   /**
    * Executes the query and returns all rows.
    *
    * @param args - Database connection and query parameters.
    */
   async all<TContext extends typeof this._params>(
      args: SqlQueryRunArgs<Pick<T, "Connection" | "Params">, TContext>,
   ): Promise<T["Row"][]> {
      const raw = await this.run(args, "read");
      const rows = this.resolveRows(raw);
      const meta = getQueryMeta(raw);
      if (meta) setQueryMeta(rows, meta);
      return rows;
   }
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
SqlQuery.register(SqlQueryHandler as unknown as abstract new (...args: any[]) => SqlQueryBaseAny);

export function newSqlQueryHandler<T extends { Row?: unknown; Params?: unknown }, Handler extends SqlQueryHandlerAny>(
   handler: Handler,
): Handler & SqlQueryColumns<T["Row"]> {
   return new Proxy(handler, {
      ownKeys(target): ArrayLike<string | symbol> {
         const row = target.source?.row;
         const rowKeys = row ? Object.keys(row) : [];
         return [...Reflect.ownKeys(target), ...rowKeys];
      },
      getOwnPropertyDescriptor(target, p: string | symbol): PropertyDescriptor | undefined {
         if (Reflect.has(target, p)) return Reflect.getOwnPropertyDescriptor(target, p);
         const source = target.source;
         if (!source) return undefined;
         const row = source.row;
         if (row && Reflect.has(row, p)) return Reflect.getOwnPropertyDescriptor(row, p);
         if (Reflect.has(source, p)) return Reflect.getOwnPropertyDescriptor(source, p);
         return undefined;
      },
      has(target, p: string | symbol): boolean {
         if (Reflect.has(target, p)) return true;
         const source = target.source;
         if (!source) return false;
         const row = source.row;
         if (row && Reflect.has(row, p)) return true;
         return Reflect.has(source, p);
      },
      get(target, p: string | symbol, receiver: unknown): unknown {
         if (Reflect.has(target, p)) return Reflect.get(target, p, receiver);
         const source = target.source;
         if (!source) return undefined;
         const row = source.row;
         if (row && Reflect.has(row, p)) return Reflect.get(row, p, receiver);
         if (Reflect.has(source, p)) return Reflect.get(source, p, receiver);
         return undefined;
      },
   }) as Handler & SqlQueryColumns<T["Row"]>;
}

function withTimeout<T>(promise: Promise<T>, ms: number, onTimeout: () => SqlRunError): Promise<T> {
   return new Promise<T>((resolve, reject) => {
      const timer = setTimeout(() => reject(onTimeout()), ms);
      promise.then(
         (v) => {
            clearTimeout(timer);
            resolve(v);
         },
         (e) => {
            clearTimeout(timer);
            reject(e);
         },
      );
   });
}

function resolveRetryable(pluginRetryable: boolean, optionRetryable: "default" | true | false | undefined): boolean {
   if (optionRetryable === true) return true;
   if (optionRetryable === false) return false;
   return pluginRetryable;
}

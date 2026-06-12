import { ok } from "#/lib/assert.js";
import { SqlQuery, type SqlQueryAny } from "#/core/query/sql-query.js";
import type { VexnorPluginAny } from "#/plugin/vexnor-plugin.js";
import { SqlError } from "#/core/sql-error.js";
import { SqlErrorCode } from "#/core/sql-error-code.js";
import type { SqlExecuteMode, SqlRunOptions } from "#/core/query/sql-query-types.js";
import { isVexnorConnection } from "#/plugin/vexnor-connection.js";
import type { SqlPipelineExecutionArgs, SqlQueryPipelinePlugin } from "./sql-query-pipeline-plugin.js";
import {
   SqlQueryPipeline,
   BeforeQueryEvent,
   AfterQueryEvent,
   type AuthorizeArgs,
   type AuthorizeHook,
   type SqlQueryPipelineOptions,
} from "./sql-query-pipeline.js";
import { SqlParamAny } from "#/core/query/sql-param.js";
import { SqlQueryHandler, SqlQueryHandlerAny } from "#/core/query/sql-query-handler.js";

export type { AuthorizeArgs, AuthorizeHook };
export { BeforeQueryEvent, AfterQueryEvent };

export type ConnectionResolverArgs<TContext extends Record<string, unknown> = Record<string, unknown>> = {
   plugin: VexnorPluginAny;
   query: SqlQueryAny;
   params: Record<string, unknown>;
   context: TContext;
   mode: SqlExecuteMode;
};

export type ConnectionResolver = <TContext extends Record<string, unknown> = Record<string, unknown>>(
   args: ConnectionResolverArgs<TContext>,
) => Promise<unknown>;

export type QueryMap = Record<string, SqlQueryAny | SqlQueryHandlerAny>;

export type ExecuteQueryArgs = {
   plugin: string;
   hash: string;
   params: Record<string, unknown>;
   location: string | null;
   mode: SqlExecuteMode;
   name: string | null;
   options?: SqlRunOptions;
};
const RequiredExecuteQueryKeys: (keyof ExecuteQueryArgs)[] = ["plugin", "hash", "params", "mode", "location", "name"];

export type SqlQueryRegistryOptions<TContext extends Record<string, unknown> = Record<string, unknown>> =
   SqlQueryPipelineOptions<TContext>;

export class SqlQueryRegistry<TContext extends Record<string, unknown> = Record<string, unknown>> {
   readonly pipeline: SqlQueryPipeline<{ Context: TContext }>;
   private readonly maps = new Map<string, Map<string, { query: SqlQueryAny; name: string }>>();
   private readonly plugins = new Map<string, VexnorPluginAny>();

   constructor(options: SqlQueryRegistryOptions<TContext> = {}) {
      this.pipeline = new SqlQueryPipeline(options);
   }

   /**
    * Attaches a query execution plugin to this registry's default pipeline.
    */
   use(plugin: SqlQueryPipelinePlugin<TContext>): () => void {
      return this.pipeline.use(plugin);
   }

   /**
    * Registers an authorization hook on this registry's default pipeline.
    */
   registerAuthorization(hook: AuthorizeHook<TContext>): void {
      this.pipeline.registerAuthorization(hook);
   }

   /**
    * Startup validation — asserts that all `.authorize()`-tagged queries have
    * at least one authorization hook registered.
    */
   checkAuthorization(): void {
      this.pipeline.checkAuthorization(this.getQueries());
   }

   /** Returns every query registered across all plugins. */
   getQueries(): SqlQueryAny[] {
      return Array.from(this.maps.values()).flatMap((map) => Array.from(map.values()).map((e) => e.query));
   }

   /**
    * Returns all registered queries that carry an `.authorize()` tag.
    */
   getAuthorizedQueries(): SqlQueryAny[] {
      return this.getQueries().filter((q) => q.authorization !== null);
   }

   /**
    * Returns all registered queries that have no `.authorize()` tag.
    */
   getUnauthorizedQueries(): SqlQueryAny[] {
      return this.getQueries().filter((q) => q.authorization === null);
   }

   /** Returns all registered queries with their plugin name, hash, and display name. */
   getRegisteredQueries(): { plugin: string; hash: string; name: string; location: string | null; hashId: string }[] {
      const result: { plugin: string; hash: string; name: string; location: string | null; hashId: string }[] = [];
      for (const [plugin, map] of this.maps) {
         for (const [hash, { query, name }] of map) {
            result.push({ plugin, hash, name, location: query.location, hashId: query.hashId });
         }
      }
      return result;
   }

   getExecutionArgs(request: unknown): ExecuteQueryArgs {
      if (!request || typeof request !== "object") {
         throw new SqlError("Expected request object with query name and params", {
            code: SqlErrorCode.QUERY_PARAMETERS_INVALID,
         });
      }

      const result = Object.fromEntries(
         RequiredExecuteQueryKeys.map((key) => {
            const value = (request as Record<string, unknown>)[key];
            if (value === undefined)
               throw new SqlError(`Missing required parameter in request: ${key}`, {
                  code: SqlErrorCode.QUERY_PARAMETERS_INVALID,
               });
            return [key, value];
         }),
      ) as ExecuteQueryArgs;
      const options = (request as { options?: SqlRunOptions }).options;
      if (options !== undefined) result.options = options;
      return result;
   }

   /**
    * Registers a set of queries under a plugin.
    *
    * Pass the module namespace directly — all `SqlQuery` exports are registered
    * under their variable names. Non-query exports are skipped with a warning.
    * Re-registering the same query is safe and idempotent.
    */
   async register(plugin: VexnorPluginAny, queries: QueryMap): Promise<void> {
      if (!this.plugins.has(plugin.name)) this.plugins.set(plugin.name, plugin);

      if (!this.maps.has(plugin.name)) this.maps.set(plugin.name, new Map());

      const map = this.maps.get(plugin.name)!;
      for (const [name, value] of Object.entries(queries)) {
         switch (true) {
            case value instanceof SqlQuery:
               map.set(await value.hash, { query: value, name });
               break;
            case value instanceof SqlQueryHandler:
               map.set(await value.source.hash, { query: value.source, name });
               break;
            default:
               console.warn(`[vexnor] QueryRegistry.register: skipping "${name}" — not a SqlQuery instance`);
               break;
         }
      }
   }

   /**
    * Executes a registered query by plugin name and hash.
    *
    * Looks up the query by hash, runs authorization and check plugin hooks,
    * dispatches before/after events, executes against the resolved connection.
    * Always rejects with {@link SqlRunError} on failure.
    * `after()` always fires — including auth/check rejections.
    */
   async execute<TResult = unknown>(
      args: ExecuteQueryArgs,
      resolver: ConnectionResolver,
      context: TContext = {} as TContext,
   ): Promise<TResult> {
      const { hash, params, mode, location, plugin: pluginName, options, name } = args;
      const entry = this.maps.get(pluginName)?.get(hash);
      if (!entry) {
         throw new SqlError(`Unknown query hash: ${hash} for plugin: ${pluginName}`, {
            code: SqlErrorCode.QUERY_NOT_FOUND,
         });
      }
      const { query } = entry;

      const plugin = this.plugins.get(pluginName);
      ok(plugin, `Unknown plugin: ${pluginName}`);

      const mergedParams = this.mergeRuntimeParams(query, params, context);
      const executionArgs: SqlPipelineExecutionArgs<TContext> = {
         mode: mode,
         plugin,
         query,
         name: entry.name,
         remote: { plugin: pluginName, hash, params, location, mode, name },
         params: mergedParams,
         context,
      };
      const queryHandler = plugin.newQueryHandler(query);

      return (await this.pipeline.execute(
         executionArgs,
         async () => {
            const connection = await resolver({ plugin, query, params, mode, context });
            const db = isVexnorConnection(connection) ? connection.db : connection;
            return await queryHandler.run({ db, params: mergedParams, options: this.withoutRetry(options) }, mode);
         },
         options,
      )) as TResult;
   }

   private mergeRuntimeParams(
      query: SqlQueryAny,
      params: Record<string, unknown>,
      runtime: Record<string, unknown>,
   ): Record<string, unknown> {
      const queryParams = query.params as Record<string, SqlParamAny> | null;
      if (!queryParams) return params;

      const hasRuntime = Object.values(queryParams).some((p) => p.isContext);
      if (!hasRuntime) return params;

      const merged: Record<string, unknown> = { ...params };
      for (const [key, p] of Object.entries(queryParams)) {
         if (p.isContext) merged[key] = runtime[key];
      }
      return merged;
   }

   private withoutRetry(options: SqlRunOptions | undefined): SqlRunOptions | undefined {
      if (!options || options.retry === undefined) return options;
      // eslint-disable-next-line unused-imports/no-unused-vars
      const { retry: _retry, ...rest } = options;
      return rest;
   }
}

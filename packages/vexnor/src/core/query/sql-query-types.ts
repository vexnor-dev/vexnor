import { SqlQueryColumn } from "#/core/query/sql-query-column.js";
import { SqlParamAny } from "#/core/query/sql-param.js";
import { Sql } from "#/core/sql-base.js";
import { SqlBuildOptions } from "#/core/builder/sql-build-options.js";
import { ContextValue } from "#/core/query/context-value.js";

export type SqlExecuteMode = "read" | "write";

export type SqlQueryFormat = "with" | "select" | "from" | "join" | "fn" | "default";

export type SqlQueryType = "main" | "inline";

export type InferSelectRowByResult<Row> =
   Row extends Record<string, unknown>
      ? {
           [K in keyof Row as `$${string & K}`]: K extends string
              ? SqlQueryColumn<{
                   Key: K;
                   Type: Row[K];
                }>
              : never;
        }
      : never;

type WithRuntimeValues<T> = T extends Record<string, unknown> ? { [K in keyof T]: T[K] | ContextValue } : T;
type SqlConnectionArg<T> = T | PromiseLike<T>;

/**
 * Accepts a raw connection, or a `VexnorConnection` whose context `TContext` extends
 * `TParams` (i.e. every key the pipeline declares exists in the query's params).
 *
 * The check works via the phantom `_context: TContext` field on `VexnorConnection` —
 * `VexnorConnection<{ Context: TContext }>` is assignable here only when `TContext extends TParams`.
 */
export type SqlPipelineDb<TConnection, TParams extends Record<string, unknown>> =
   | SqlConnectionArg<TConnection>
   | { readonly db: TConnection; readonly _context: (context: TParams) => void }
   | PromiseLike<{ readonly db: TConnection; readonly _context: (context: TParams) => void }>;

/** Arguments passed to query execution methods (`getAll`, `getOneRequired`, `getOneOptional`, `run`). Requires `params` only when the query declares named parameters. */
export type SqlRunArgs<T extends { Connection: unknown; Params?: unknown }> =
   T["Params"] extends Record<string, unknown>
      ? {
           db: SqlConnectionArg<T["Connection"]>;
           params: WithRuntimeValues<T["Params"]>;
           options?: SqlBuildOptions & SqlRunOptions;
        }
      : {
           db: SqlConnectionArg<T["Connection"]>;
           params?: WithRuntimeValues<T["Params"]>;
           options?: SqlBuildOptions & SqlRunOptions;
        };

/**
 * Public query run arguments. Allows a raw connection or a `VexnorConnection` whose pipeline
 * context `TContext` is a subset of the query's params (`TContext extends TParams`).
 *
 * Every key the pipeline expects must be present in the query's declared params.
 */
export type SqlQueryRunArgs<
   T extends { Connection: unknown; Params?: unknown },
   TContext extends T["Params"] extends Record<string, unknown> ? T["Params"] : Record<string, unknown> =
      T["Params"] extends Record<string, unknown> ? T["Params"] : Record<string, unknown>,
> =
   T["Params"] extends Record<string, unknown>
      ? {
           db: SqlPipelineDb<T["Connection"], TContext>;
           params: WithRuntimeValues<T["Params"]>;
           options?: SqlBuildOptions & SqlRunOptions;
        }
      : {
           db: SqlConnectionArg<T["Connection"]>;
           params?: WithRuntimeValues<T["Params"]>;
           options?: SqlBuildOptions & SqlRunOptions;
        };

/**
 * Mutable ref object for capturing query execution metadata.
 * Pass an empty object via `options.meta` — the handler populates it after execution.
 */
export type QueryMeta = {
   /** The SQL text sent to the database */
   sql?: string;
   /** Parameterized values */
   params?: unknown[];
   /** Execution duration in milliseconds */
   duration?: number;
};

/**
 * Runtime execution options — separate from SQL build options.
 *
 * - `timeout` — abort the query after this many milliseconds; throws `SqlRunError` with code `QUERY_TIMEOUT`
 * - `retryable` — overrides the plugin's automatic retryable detection:
 *   - `"default"` (or omitted) — plugin decides based on driver error codes
 *   - `true` — always marked as retryable regardless of the error
 *   - `false` — never marked as retryable regardless of error
 * - `meta` — mutable ref object; if provided, populated with sql text, params, and duration after execution
 */
export type SqlRunOptions = {
   timeout?: number;
   retryable?: "default" | true | false;
   retry?: SqlRetryOptions | false;
   meta?: QueryMeta;
};

export type SqlRetryArgs<TExecution = unknown> = {
   error: unknown;
   attempt: number;
   maxAttempts: number;
   execution?: TExecution;
};

export type SqlRetryOptions<TExecution = unknown> = {
   /**
    * Total attempts, including the initial execution. Defaults to `1`.
    */
   maxAttempts?: number;
   /**
    * Delay before the next attempt. Defaults to `0`.
    */
   delayMs?: number | ((args: SqlRetryArgs<TExecution>) => number | Promise<number>);
   /**
    * Return `true` to retry the failed attempt.
    * Defaults to retrying only `SqlRunError`s with `retryable: true`.
    */
   shouldRetry?: (args: SqlRetryArgs<TExecution>) => boolean | Promise<boolean>;
};

/** Arguments passed to `getSql()`. Requires `params` only when the query declares named parameters. */
export type SqlInputArgs<Params> =
   Params extends Record<string, unknown>
      ? { params: WithRuntimeValues<Params>; options?: SqlBuildOptions }
      : { params?: WithRuntimeValues<Params>; options?: SqlBuildOptions };

export function hasParams(value: unknown): value is { params: Record<string, SqlParamAny> } {
   if (!value) return false;
   if (typeof value !== "object") return false;
   return "params" in value;
}

export function hasRow(value: unknown): value is { row: Record<string, Sql> } {
   if (!value) return false;
   if (!(value instanceof Sql)) return false;
   return "row" in value;
}

export type SqlQueryOptions = {
   queryType?: SqlQueryType | null;
   queryFormat?: SqlQueryFormat | null;
   paramKey?: string | null;
};

export type SqlQueryScope = { cte?: boolean } & SqlQueryOptions;

export type RemoteClient = {
   remoteExecute: <TResult>(config: {
      plugin: string;
      hash: string;
      params: Record<string, unknown>;
      name: string | null;
      location: string | null;
      mode?: SqlExecuteMode;
      options?: SqlRunOptions;
      meta?: QueryMeta;
   }) => Promise<TResult>;
};

export function isRemoteClient(db: unknown): db is RemoteClient {
   return typeof db === "object" && db !== null && "remoteExecute" in db;
}

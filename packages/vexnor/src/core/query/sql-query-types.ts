import { SqlQueryColumn } from "#/core/query/sql-query-column.js";
import { SqlParamAny } from "#/core/query/sql-param.js";
import { Sql } from "#/core/sql-base.js";
import { SqlBuildOptions } from "#/core/builder/sql-build-options.js";

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

/** Arguments passed to query execution methods (`getAll`, `getOneRequired`, `getOneOptional`, `run`). Requires `params` only when the query declares named parameters. */
export type SqlRunArgs<T extends { Connection: unknown; Params?: unknown }> =
   T["Params"] extends Record<string, unknown>
      ? {
           db: T["Connection"] | PromiseLike<T["Connection"]>;
           params: T["Params"];
           options?: SqlBuildOptions & SqlRunOptions;
        }
      : {
           db: T["Connection"] | PromiseLike<T["Connection"]>;
           params?: T["Params"];
           options?: SqlBuildOptions & SqlRunOptions;
        };

/**
 * Runtime execution options — separate from SQL build options.
 *
 * - `timeout` — abort the query after this many milliseconds; throws `SqlRunError` with code `QUERY_TIMEOUT`
 * - `retryable` — override the plugin's automatic retryable detection:
 *   - `"default"` (or omitted) — plugin decides based on driver error codes
 *   - `true` — always mark as retryable regardless of error
 *   - `false` — never mark as retryable regardless of error
 */
export type SqlRunOptions = {
   timeout?: number;
   retryable?: "default" | true | false;
};

/** Arguments passed to `getSql()`. Requires `params` only when the query declares named parameters. */
export type SqlInputArgs<Params> =
   Params extends Record<string, unknown>
      ? { params: Params; options?: SqlBuildOptions }
      : { params?: Params; options?: SqlBuildOptions };

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
   }) => Promise<TResult>;
};

export function isRemoteClient(db: unknown): db is RemoteClient {
   return typeof db === "object" && db !== null && "remoteExecute" in db;
}

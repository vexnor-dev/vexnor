import {
   deserialize,
   getQueryMeta,
   getQueryName,
   ok,
   type QueryMeta,
   RemoteClient,
   setQueryMeta,
   SqlErrorCode,
   SqlQuery,
   SqlQueryHandler,
   SqlRunArgs,
   SqlRunError,
} from "@vexnor/core";
import type { QueryResult } from "pg";
import { PostgresTokenizer } from "#src/postgres-tokenizer.js";
import pkg from "../package.json" with { type: "json" };

type PostgresResult<T> = QueryResult<RowOrDefault<T>>

// Postgres transient error codes that are safe to retry
const RETRYABLE_PG_CODES = new Set(["57P01", "08006", "08001", "08004", "40001", "40P01"]);

function isRetryablePgError(err: unknown): boolean {
   return (
      typeof err === "object" && err !== null && "code" in err && RETRYABLE_PG_CODES.has((err as { code: string }).code)
   );
}

export const PLUGIN_NAME = pkg.name;

export type PostgresClient = {
   query: <TRow>(queryConfig: { text: string; values: unknown[] }) => Promise<QueryResult<RowOrDefault<TRow>>>;
};

export type RowOrDefault<T> = T extends object ? T : never;

export class PostgresQueryHandler<T extends { Row?: unknown; Params?: unknown }> extends SqlQueryHandler<
   Pick<T, "Row" | "Params"> & {
      Connection: PostgresClient | RemoteClient;
      Read: PostgresResult<T["Row"]>;
      Write: PostgresResult<T["Row"]>;
   }
> {
   constructor(readonly source: SqlQuery<Pick<T, "Row" | "Params">>) {
      super(source, { pluginName: PLUGIN_NAME });
   }

   getOptions(args: SqlRunArgs<{ Connection: PostgresClient; Params: T["Params"] }>) {
      let queryInput = undefined;
      try {
         const newArgs = {
            ...args,
            options: {
               ...args.options,
               tokenizer: new PostgresTokenizer(this.source.id),
               dialect: "postgresql",
               paramFormat: (args: { index: number }) => `$${args.index + 1}`,
            },
         };
         queryInput = this.source.getSql(newArgs);
         return queryInput;
      } catch (err) {
         throw new SqlRunError(`Error building postgres query '${this.source.id}'`, this.source, {
            cause: err,
            code: SqlErrorCode.QUERY_BUILD_FAILED,
         });
      }
   }

   resolveRows(result: PostgresResult<T["Row"]>): T["Row"][] {
      return result.rows;
   }

   deserialize<TResult = QueryResult<RowOrDefault<T["Row"]>>>(result: TResult, remote: boolean): TResult {
      ok(isQueryResult(result), `Postgres query result should be an object with a 'rows' property.`);
      const rowSchema = this.getRowSchema(remote);
      for (let i = 0; i < result.rows.length; i++) {
         result.rows[i] = deserialize(result.rows[i]!, rowSchema);
      }

      return result as TResult;
   }

   serialize<TResult extends QueryResult<RowOrDefault<T["Row"]>> = QueryResult<RowOrDefault<T["Row"]>>>(value: TResult): TResult {
      const { rows, rowCount, command, oid } = value;
      const result = { rows, rowCount, command, oid } as TResult;
      const meta = getQueryMeta(value);
      if (meta) setQueryMeta(result, meta);
      return result;
   }

   /**
    * Executes the query and returns the raw `pg` `QueryResult`.
    *
    * You typically don't call this directly — use `getAll()`, `getOneRequired()`,
    * or `getOneOptional()` instead. Call `execute()` when you need access to the full
    * `QueryResult` object (e.g. `rowCount`, `fields`).
    *
    * @param args - Database connection and query parameters.
    * @param _mode
    * @param meta
    */
   async execute(
      args: SqlRunArgs<{ Connection: PostgresClient; Params: T["Params"] }>,
      _mode?: unknown,
      meta?: QueryMeta,
   ) {
      const { db, options: { debug } = {} } = args;
      const resolvedDb = await db;
      let queryInput = undefined;
      try {
         queryInput = this.getOptions(args);
         if (debug) debug(Object.freeze(queryInput));
         const { text, values } = queryInput;
         const result = await resolvedDb.query({ text, values });
         if (meta) { meta.sql = text; meta.params = values; }
         return result;
      } catch (err) {
         const queryName = await getQueryName(this.source);
         throw new SqlRunError(`Error running POSTGRES query '${queryName ?? this.source.id}' at ${this.source.location}.`, this.source, {
            cause: err,
            sql: queryInput?.text,
            code: isRetryablePgError(err) ? SqlErrorCode.QUERY_RETRYABLE_FAILURE : SqlErrorCode.QUERY_EXECUTION_FAILED,
            retryable: isRetryablePgError(err),
         });
      }
   }
}

function isQueryResult<T extends object>(x: unknown): x is QueryResult<T> {
   return typeof x === "object" && x !== null && "rows" in x && Array.isArray((x as { rows: unknown }).rows);
}

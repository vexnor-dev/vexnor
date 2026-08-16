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
import { DuckDBTokenizer } from "#src/duckdb-tokenizer.js";
import { executeDuckDBQuery, type DuckDBClient } from "#src/duckdb-execution.js";
import pkg from "../package.json" with { type: "json" };

export type { DuckDBClient } from "#src/duckdb-execution.js";

export const PLUGIN_NAME = pkg.name;

export type DuckDBQueryResult<TRow> = {
   rows: TRow[];
   rowCount: number;
   rowsChanged: number;
   statementType: number;
};

type RowOrDefault<T> = T extends object ? T : never;

function isRetryableDuckDBError(error: unknown): boolean {
   if (!(error instanceof Error)) return false;
   return /transaction conflict|serialization|connection (?:closed|reset)|could not connect|timed? ?out|http[^\n]*\b5\d\d\b/i.test(error.message);
}

export class DuckDBQueryHandler<T extends { Row?: unknown; Params?: unknown }> extends SqlQueryHandler<
   Pick<T, "Row" | "Params"> & {
      Connection: DuckDBClient | RemoteClient;
      Read: DuckDBQueryResult<RowOrDefault<T["Row"]>>;
      Write: DuckDBQueryResult<RowOrDefault<T["Row"]>>;
   }
> {
   constructor(readonly source: SqlQuery<Pick<T, "Row" | "Params">>) {
      super(source, { pluginName: PLUGIN_NAME });
   }

   getOptions(args: SqlRunArgs<{ Connection: DuckDBClient; Params: T["Params"] }>) {
      try {
         return this.source.getSql({
            ...args,
            options: {
               ...args.options,
               tokenizer: new DuckDBTokenizer(this.source.id),
               dialect: "duckdb",
               paramFormat: ({ index }: { index: number }) => `$${index + 1}`,
            },
         });
      } catch (error) {
         throw new SqlRunError(`Error building DuckDB query '${this.source.id}'`, this.source, {
            cause: error,
            code: SqlErrorCode.QUERY_BUILD_FAILED,
         });
      }
   }

   resolveRows(result: DuckDBQueryResult<RowOrDefault<T["Row"]>>): T["Row"][] {
      return result.rows;
   }

   deserialize<TResult extends DuckDBQueryResult<RowOrDefault<T["Row"]>>>(result: TResult, remote: boolean): TResult {
      ok(isDuckDBQueryResult(result), "DuckDB query result should be an object with a 'rows' property.");
      const rowSchema = this.getRowSchema(remote);
      for (let i = 0; i < result.rows.length; i++) {
         result.rows[i] = deserialize(result.rows[i]!, rowSchema);
      }
      return result;
   }

   serialize<TResult extends DuckDBQueryResult<RowOrDefault<T["Row"]>>>(value: TResult): TResult {
      const result = {
         rows: value.rows,
         rowCount: value.rowCount,
         rowsChanged: value.rowsChanged,
         statementType: value.statementType,
      } as TResult;
      const meta = getQueryMeta(value);
      if (meta) setQueryMeta(result, meta);
      return result;
   }

   async execute(
      args: SqlRunArgs<{ Connection: DuckDBClient; Params: T["Params"] }>,
      _mode?: unknown,
      meta?: QueryMeta,
   ): Promise<DuckDBQueryResult<RowOrDefault<T["Row"]>>> {
      const { db, options: { debug } = {} } = args;
      const resolvedDb = await db;
      let queryInput: ReturnType<DuckDBQueryHandler<T>["getOptions"]> | undefined;
      try {
         queryInput = this.getOptions(args);
         if (debug) debug(Object.freeze(queryInput));
         const { text, values } = queryInput;
         const executionResult = await executeDuckDBQuery(resolvedDb, text, values);
         if (meta) {
            meta.sql = text;
            meta.params = values;
         }
         return {
            rows: executionResult.rows as RowOrDefault<T["Row"]>[],
            rowCount: executionResult.rows.length,
            rowsChanged: executionResult.rowsChanged,
            statementType: executionResult.statementType,
         };
      } catch (error) {
         const queryName = await getQueryName(this.source);
         const retryable = isRetryableDuckDBError(error);
         throw new SqlRunError(
            `Error running DUCKDB query '${queryName ?? this.source.id}' at ${this.source.location}.`,
            this.source,
            {
               cause: error,
               sql: queryInput?.text,
               code: retryable ? SqlErrorCode.QUERY_RETRYABLE_FAILURE : SqlErrorCode.QUERY_EXECUTION_FAILED,
               retryable,
            },
         );
      }
   }
}

function isDuckDBQueryResult<T extends object>(value: unknown): value is DuckDBQueryResult<T> {
   return typeof value === "object" && value !== null && "rows" in value && Array.isArray(value.rows);
}

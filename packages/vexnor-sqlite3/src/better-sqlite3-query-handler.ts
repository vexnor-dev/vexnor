import {
   type RemoteClient,
   SqlErrorCode,
   SqlExecuteMode,
   SqlQuery,
   SqlQueryHandler,
   SqlRunArgs,
   SqlRunError,
} from "vexnor";
import type { Database, RunResult } from "better-sqlite3";
import { Sqlite3Formatter } from "#/sqlite3-formatter.js";
import { Sqlite3Tokenizer } from "#/sqlite3-tokenizer.js";
import pkg from "../package.json" with { type: "json" };

// SQLite transient error codes safe to retry
const RETRYABLE_SQLITE_CODES = new Set(["SQLITE_BUSY", "SQLITE_LOCKED"]);

function isRetryableSqliteError(err: unknown): boolean {
   if (typeof err !== "object" || err === null) return false;
   const code = (err as { code?: string }).code;
   return code !== undefined && RETRYABLE_SQLITE_CODES.has(code);
}

export const PLUGIN_NAME = pkg.name;

export type Sqlite3Client = Database;

export type QueryResult<T> = { rows: T[] };

export class BetterSqlite3QueryHandler<T extends { Row?: unknown; Params?: unknown }> extends SqlQueryHandler<
   Pick<T, "Row" | "Params"> & {
      Connection: Sqlite3Client | RemoteClient;
      QueryResult: RunResult;
   }
> {
   static Formatter = new Sqlite3Formatter();

   constructor(readonly query: SqlQuery<Pick<T, "Row" | "Params">>) {
      super(query, { pluginName: PLUGIN_NAME });
   }

   // eslint-disable-next-line unused-imports/no-unused-vars
   resolveRows(_res: RunResult): T["Row"][] {
      throw new Error("Method not supported: better-sqlite3 result doesn't include any rows");
   }

   // RunResult has no rows — deserialization is a no-op for write results
   deserialize<TResult>(result: TResult): TResult {
      if (isQueryResult(result)) {
         return {
            ...result,
            rows: this.deserializeRows(result.rows, false),
         };
      }

      return result;
   }

   getOptions(args: SqlRunArgs<{ Connection: Sqlite3Client; Params: T["Params"] }>) {
      let queryInput = undefined;
      try {
         // Create a new options object to inject the tokenizer
         const newArgs: SqlRunArgs<{ Connection: Sqlite3Client; Params: T["Params"] }> = {
            ...args,
            options: {
               ...args.options,
               formatProvider: BetterSqlite3QueryHandler.Formatter,
               tokenizer: new Sqlite3Tokenizer(),
               dialect: "sqlite",
            },
         };

         const { values, text } = this.query.getSql(newArgs);
         queryInput = {
            sql: text,
            values,
         };
         return queryInput;
      } catch (err) {
         throw new SqlRunError(`Error building sqlite query '${this.query.id}'`, this.query, {
            cause: err,
            code: SqlErrorCode.QUERY_BUILD_FAILED,
         });
      }
   }

   /**
    * Executes a write query (INSERT, UPDATE, DELETE) and returns the raw `better-sqlite3` `RunResult`.
    *
    * For SELECT queries use `getAll()`, `getOneRequired()`, or `getOneOptional()` instead.
    * Call `run()` when you need access to `RunResult` metadata such as `changes` or `lastInsertRowid`.
    *
    * @param args - Database connection and query parameters.
    * @param mode
    */
   async execute<TResult>(
      args: SqlRunArgs<{ Connection: Sqlite3Client; Params: T["Params"] }>,
      mode: SqlExecuteMode = "mutation",
   ): Promise<TResult> {
      const { db, options: { debug } = {} } = args;
      const resolvedDb = await db;

      let queryConfig = undefined;
      try {
         queryConfig = this.getOptions(args);
         if (debug) debug(Object.freeze(queryConfig));
         const statement = (resolvedDb as Database).prepare<unknown[] | object, T["Row"]>(queryConfig.sql);
         if (mode === "query" /*|| statement.reader*/) {
            const rows = statement.all(queryConfig.values);
            return Promise.resolve({ rows } as TResult);
         }

         return Promise.resolve(statement.run(queryConfig.values) as TResult);
      } catch (err) {
         throw new SqlRunError(`Error running sqlite query '${this.query.id}'`, this.query, {
            cause: err,
            sql: queryConfig?.sql,
            code: isRetryableSqliteError(err)
               ? SqlErrorCode.QUERY_RETRYABLE_FAILURE
               : SqlErrorCode.QUERY_EXECUTION_FAILED,
            retryable: isRetryableSqliteError(err),
         });
      }
   }

   /**
    * Overrides base all() because sqlite3 reads go through execute(args, "query") directly,
    * bypassing the RunResult shape that run() returns.
    */
   override async all(
      args: SqlRunArgs<{ Connection: Sqlite3Client | RemoteClient; Params: T["Params"] }>,
   ): Promise<T["Row"][]> {
      const result = await this.run<QueryResult<T["Row"]>>(args, "query");
      return this.deserializeRows(result.rows, true);
   }

   override async run<TResult = RunResult>(
      args: SqlRunArgs<
         Pick<
            Pick<T, "Row" | "Params"> & { Connection: Sqlite3Client | RemoteClient; QueryResult: RunResult },
            "Connection" | "Params"
         >
      >,
      mode: SqlExecuteMode = "mutation",
   ): Promise<TResult> {
      return super.run(args, mode);
   }
}

function isQueryResult<T extends object>(x: unknown): x is QueryResult<T> {
   return typeof x === "object" && x !== null && "rows" in x && Array.isArray(x.rows);
}

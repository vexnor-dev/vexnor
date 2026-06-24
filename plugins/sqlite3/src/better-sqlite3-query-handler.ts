import {
   getQueryName,
   ok,
   type RemoteClient,
   SqlErrorCode,
   SqlExecuteMode,
   SqlQuery,
   SqlQueryHandler,
   SqlRunArgs,
   SqlRunError,
   type QueryMeta,
} from "@vexnor/core";
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

export type Sqlite3ReadResult<T> = { rows: T[] };
export type Sqlite3WriteResult = RunResult;

export class BetterSqlite3QueryHandler<T extends { Row?: unknown; Params?: unknown }> extends SqlQueryHandler<
   Pick<T, "Row" | "Params"> & {
      Connection: Sqlite3Client | RemoteClient;
      Read: Sqlite3ReadResult<T["Row"]>;
      Write: Sqlite3WriteResult;
   }
> {
   static Formatter = new Sqlite3Formatter();

   constructor(readonly source: SqlQuery<Pick<T, "Row" | "Params">>) {
      super(source, { pluginName: PLUGIN_NAME });
   }

   // eslint-disable-next-line unused-imports/no-unused-vars
   resolveRows(_res: Sqlite3ReadResult<T["Row"]>): T["Row"][] {
      throw new Error("Method not supported: better-sqlite3 result doesn't include any rows");
   }

   // RunResult has no rows — deserialization is a no-op for write results
   deserialize(result: Sqlite3ReadResult<T["Row"]>): Sqlite3ReadResult<T["Row"]> {
      if (this.isReadResult(result)) {
         return {
            ...result,
            rows: this.deserializeRows(result.rows, false),
         };
      }

      return result;
   }

   isReadResult(result: unknown): result is Sqlite3ReadResult<T["Row"]> {
      return typeof result === "object" && result !== null && "rows" in result && Array.isArray(result.rows);
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

         const { values, text } = this.source.getSql(newArgs);
         queryInput = {
            sql: text,
            values,
         };
         return queryInput;
      } catch (err) {
         throw new SqlRunError(`Error building sqlite query '${this.source.id}'`, this.source, {
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
   execute(
      args: SqlRunArgs<{ Connection: Sqlite3Client; Params: T["Params"] }>,
      mode: "read",
      meta?: QueryMeta,
   ): Promise<Sqlite3ReadResult<T["Row"]>>;
   execute(args: SqlRunArgs<{ Connection: Sqlite3Client; Params: T["Params"] }>, mode?: "write", meta?: QueryMeta): Promise<Sqlite3WriteResult>;
   async execute(
      args: SqlRunArgs<{ Connection: Sqlite3Client; Params: T["Params"] }>,
      mode: SqlExecuteMode = "write",
      meta?: QueryMeta,
   ): Promise<Sqlite3ReadResult<T["Row"]> | Sqlite3WriteResult> {
      const { db, options: { debug } = {} } = args;
      const resolvedDb = await db;

      let queryConfig = undefined;
      try {
         queryConfig = this.getOptions(args);
         if (debug) debug(Object.freeze(queryConfig));
         const statement = (resolvedDb as Database).prepare<unknown[] | object, T["Row"]>(queryConfig.sql);
         if (meta) { meta.sql = queryConfig.sql; meta.params = queryConfig.values; }
         if (mode === "read" /*|| statement.reader*/) {
            const rows = statement.all(queryConfig.values);
            return Promise.resolve({ rows });
         }

         const result = statement.run(queryConfig.values);
         return Promise.resolve(result);
      } catch (err) {
         const queryName = await getQueryName(this.source);
         throw new SqlRunError(`Error running SQLITE3 query '${queryName ?? this.source.id}' at ${this.source.location}.`, this.source, {
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
      const result = await super.run(args, "read");
      ok(this.isReadResult(result), `Query result doesn't is not a read result`);

      return this.deserializeRows(result.rows, true);
   }

   override run(
      args: SqlRunArgs<
         Pick<
            Pick<T, "Row" | "Params"> & { Connection: Sqlite3Client | RemoteClient; Write: Sqlite3WriteResult },
            "Connection" | "Params"
         >
      >,
      mode: "read",
   ): Promise<Sqlite3ReadResult<T["Row"]>>;
   override run(
      args: SqlRunArgs<
         Pick<
            Pick<T, "Row" | "Params"> & { Connection: Sqlite3Client | RemoteClient; Write: Sqlite3WriteResult },
            "Connection" | "Params"
         >
      >,
      mode?: "write",
   ): Promise<Sqlite3WriteResult>;
   override async run(
      args: SqlRunArgs<
         Pick<
            Pick<T, "Row" | "Params"> & { Connection: Sqlite3Client | RemoteClient; Write: Sqlite3WriteResult },
            "Connection" | "Params"
         >
      >,
      mode: SqlExecuteMode = "write",
   ): Promise<Sqlite3ReadResult<T["Row"]> | Sqlite3WriteResult> {
      return await super.run(args, mode);
   }
}

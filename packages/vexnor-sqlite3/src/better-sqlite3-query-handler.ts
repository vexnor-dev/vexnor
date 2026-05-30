import { SqlRunArgs, SqlQueryHandler, SqlQuery, SqlRunError, isRemoteClient, RemoteClient } from "vexnor";
import type { Database, RunResult } from "better-sqlite3";
import { Sqlite3Formatter } from "#/sqlite3-formatter.js";
import { Sqlite3Tokenizer } from "#/sqlite3-tokenizer.js";
import pkg from "../package.json" with { type: "json" };

export const PLUGIN_NAME = pkg.name;

export type Sqlite3Client = Database | RemoteClient;

export class BetterSqlite3QueryHandler<T extends { Row?: unknown; Params?: unknown }> extends SqlQueryHandler<
   Pick<T, "Row" | "Params"> & {
      QueryResult: RunResult;
      Connection: Sqlite3Client;
   }
> {
   static Formatter = new Sqlite3Formatter();

   constructor(readonly query: SqlQuery<Pick<T, "Row" | "Params">>) {
      super(query);
   }

   // eslint-disable-next-line unused-imports/no-unused-vars
   resolveRows(_res: RunResult): T["Row"][] {
      throw new Error("Method not supported: better-sqlite3 result doesn't include any rows");
   }

   // RunResult has no rows — deserialization is handled in all() directly
   deserialize(result: RunResult): RunResult {
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
         throw new SqlRunError(`Error building sqlite query '${this.query.id}'`, this.query, { cause: err });
      }
   }

   /**
    * Executes a write query (INSERT, UPDATE, DELETE) and returns the raw `better-sqlite3` `RunResult`.
    *
    * For SELECT queries use `getAll()`, `getOneRequired()`, or `getOneOptional()` instead.
    * Call `run()` when you need access to `RunResult` metadata such as `changes` or `lastInsertRowid`.
    *
    * @param args - Database connection and query parameters.
    */
   async execute(args: SqlRunArgs<{ Connection: Sqlite3Client; Params: T["Params"] }>): Promise<RunResult> {
      const { db, options: { debug } = {} } = args;
      const resolvedDb = await db;

      if (isRemoteClient(resolvedDb)) {
         const hash = await this.query.hash;
         const params = (args as { params?: Record<string, unknown> }).params ?? {};
         return resolvedDb.remoteExecute<RunResult>({ plugin: PLUGIN_NAME, hash, params });
      }

      let queryConfig = undefined;
      try {
         queryConfig = this.getOptions(args);
         if (debug) debug(Object.freeze(queryConfig));
         const result = (resolvedDb as Database).prepare(queryConfig.sql).run(queryConfig.values);
         return Promise.resolve(result);
      } catch (err) {
         throw new SqlRunError(
            `Error running sqlite query '${this.query.id}'`,
            this.query,
            { cause: err },
            queryConfig?.sql,
         );
      }
   }

   async all(args: SqlRunArgs<{ Connection: Sqlite3Client; Params: T["Params"] }>): Promise<T["Row"][]> {
      const { db, options: { debug } = {} } = args;
      const resolvedDb = await db;
      const remote = isRemoteClient(resolvedDb);

      if (remote) {
         const hash = await this.query.hash;
         const params = (args as { params?: Record<string, unknown> }).params ?? {};
         const result = await (resolvedDb as RemoteClient).remoteExecute<{ rows: T["Row"][] }>({
            plugin: PLUGIN_NAME,
            hash,
            params,
         });
         return this.deserializeRows(result.rows, true);
      }

      let queryConfig = undefined;
      try {
         queryConfig = this.getOptions(args);
         if (debug) debug(Object.freeze(queryConfig));
         const result = (resolvedDb as Database)
            .prepare<unknown[] | object, T["Row"]>(queryConfig.sql)
            .all(queryConfig.values);
         return this.deserializeRows(result, false);
      } catch (err) {
         throw new SqlRunError(
            `Error running sqlite query '${this.query.id}'`,
            this.query,
            { cause: err },
            queryConfig?.sql,
         );
      }
   }
}

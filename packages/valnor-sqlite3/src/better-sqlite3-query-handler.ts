import { SqlRunArgs, SqlQueryHandler, SqlQuery, SqlRunError } from "valnor";
import type { Database, RunResult } from "better-sqlite3";
import { Sqlite3Formatter } from "#/sqlite3-formatter.js";
import { Sqlite3Tokenizer } from "#/sqlite3-tokenizer.js";

export class BetterSqlite3QueryHandler<T extends { Row?: unknown; Params?: unknown }> extends SqlQueryHandler<
   Pick<T, "Row" | "Params"> & {
      QueryResult: RunResult;
      Connection: Database;
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

   getOptions(args: SqlRunArgs<{ Connection: Database; Params: T["Params"] }>) {
      let queryInput = undefined;
      try {
         // Create a new options object to inject the tokenizer
         const newArgs: SqlRunArgs<{ Connection: Database; Params: T["Params"] }> = {
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
   async run(args: SqlRunArgs<{ Connection: Database; Params: T["Params"] }>): Promise<RunResult> {
      const { db, options: { debug } = {} } = args;
      let queryConfig = undefined;
      try {
         queryConfig = this.getOptions(args);
         if (debug) debug(Object.freeze(queryConfig));
         const result = (await db).prepare(queryConfig.sql).run(queryConfig.values);
         return Promise.resolve(result);
      } catch (err) {
         throw new SqlRunError(`Error running sqlite query '${this.query.id}'`, this.query, { cause: err }, queryConfig?.sql);
      }
   }

   async all(args: SqlRunArgs<{ Connection: Database; Params: T["Params"] }>): Promise<T["Row"][]> {
      let queryConfig = undefined;
      const { db, options: { debug } = {} } = args;
      try {
         queryConfig = this.getOptions(args);
         if (debug) debug(Object.freeze(queryConfig));
         const result = (await db).prepare<unknown[] | object, T["Row"]>(queryConfig.sql).all(queryConfig.values);
         return Promise.resolve(result);
      } catch (err) {
         throw new SqlRunError(`Error running sqlite query '${this.query.id}'`, this.query, { cause: err }, queryConfig?.sql);
      }
   }
}

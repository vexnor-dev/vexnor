import { Params, RowOut, SqlQueryHandler, SqlRunArgs } from "valnor";
import type { Database, RunResult } from "better-sqlite3";
import { Sqlite3Formatter } from "./sqlite3-formatter.js";
import { Sqlite3Tokenizer } from "./sqlite3-tokenizer.js";

export class BetterSqlite3QueryHandler<T extends { Row: RowOut; Params?: Params }> extends SqlQueryHandler<{
   Row: T["Row"];
   Params?: T["Params"];
   QueryResult: RunResult;
   QueryClient: Request;
}> {
   static FormatProvider = new Sqlite3Formatter();

   resolveRows(): T["Row"][] {
      throw new Error("Method not supported: better-sqlite3 result doesn't include any rows");
   }

   getOptions(args: SqlRunArgs<Database, T["Params"]>) {
      let queryInput = undefined;
      try {
         // Create a new options object to inject the tokenizer
         const optionsWithTokenizer = {
            ...args.options,
            formatProvider: BetterSqlite3QueryHandler.FormatProvider,
            tokenizer: new Sqlite3Tokenizer(this.sqlQuery.name),
         };

         const newArgs = {
            ...args,
            options: optionsWithTokenizer,
         };

         queryInput = {
            sql: this.sqlQuery.getSql(newArgs),
            values: this.sqlQuery.getValues(newArgs),
         };
         return queryInput;
      } catch (err) {
         console.error(err, "\n", queryInput?.sql ?? "error building core");
         throw err;
      }
   }

   /**
    * Executes the core and returns the result
    * @param args
    */
   run(args: SqlRunArgs<Database, T["Params"]>): RunResult {
      const { db, options: { debug } = {} } = args;
      let queryConfig = undefined;
      try {
         queryConfig = this.getOptions(args);
         if (debug) debug(Object.freeze(queryConfig));
         return db.prepare(queryConfig.sql).run(queryConfig.values);
      } catch (err) {
         console.error(err, "\n", queryConfig?.sql ?? "error building core");
         throw err;
      }
   }

   getAll(args: SqlRunArgs<Database, T["Params"]>): T["Row"][] {
      let queryConfig = undefined;
      const { db, options: { debug } = {} } = args;
      try {
         queryConfig = this.getOptions(args);
         if (debug) debug(Object.freeze(queryConfig));
         return db.prepare<unknown[] | object, T["Row"]>(queryConfig.sql).all(queryConfig.values);
      } catch (err) {
         console.error(err, "\n", queryConfig?.sql ?? "error building core");
         throw err;
      }
   }
}

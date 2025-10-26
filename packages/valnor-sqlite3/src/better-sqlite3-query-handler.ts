import { Params, RowOut, SqlQueryHandler, SqlRunArgs } from "valnor";
import type { Database, RunResult } from "better-sqlite3";
import { Sqlite3Formatter } from "./sqlite3-formatter.js";
import { Sqlite3Tokenizer } from "./sqlite3-tokenizer.js";
import { ok } from "assert";

export class BetterSqlite3QueryHandler<T extends { Row: RowOut; Params?: Params }> extends SqlQueryHandler<{
   Row: T["Row"];
   Params?: T["Params"];
   QueryResult: RunResult;
   QueryClient: Request;
}> {
   static Formatter = new Sqlite3Formatter();

   resolveRows(): T["Row"][] {
      throw new Error("Method not supported: better-sqlite3 result doesn't include any rows");
   }

   getOptions(args: SqlRunArgs<Database, T["Params"]>) {
      let queryInput = undefined;
      try {
         // Create a new options object to inject the tokenizer
         const optionsWithTokenizer = {
            ...args.options,
            formatProvider: BetterSqlite3QueryHandler.Formatter,
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

   getOneOptional(args: SqlRunArgs<Database, T["Params"]>): T["Row"] | undefined {
      const rows = this.getAll(args);
      return rows.length > 0 ? rows[0] : undefined;
   }

   getOneRequired(args: SqlRunArgs<Database, T["Params"]>): T["Row"] {
      const rows = this.getAll(args);
      ok(rows.length === 1, `Expected one row, actual is ${rows.length} rows.`);
      ok(rows[0], `The one row in result is not defined: ${rows[0]}`);
      return rows[0];
   }
}

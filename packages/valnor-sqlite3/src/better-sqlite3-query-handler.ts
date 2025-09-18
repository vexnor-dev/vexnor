import { isSqlRunOptions, RowOut, SqlQueryHandler, SqlRunArgs, SqlValuesArgs } from "valnor";
import type { Database, RunResult } from "better-sqlite3";
import { Sqlite3FormatProvider } from "./sqlite3-format-provider.js";

export class BetterSqlite3QueryHandler<
   T extends { Row: RowOut; Params: Record<string, unknown> | undefined; QueryResult: RunResult },
   TDbClient extends Database = Database,
> extends SqlQueryHandler<T> {
   static FormatProvider = new Sqlite3FormatProvider();

   resolveRows(): T["Row"][] {
      throw new Error("Method not supported: better-sqlite3 result doesn't include any rows");
   }

   getOptions(...args: SqlRunArgs<TDbClient, T["Params"]>) {
      // eslint-disable-next-line unused-imports/no-unused-vars
      const [_, params] = args;
      const _args_: SqlValuesArgs<T["Params"]> = {
         params,
         options: { formatProvider: BetterSqlite3QueryHandler.FormatProvider },
      } as SqlValuesArgs<T["Params"]>;
      let queryInput = undefined;
      try {
         queryInput = {
            sql: this.sqlQuery.getSql(_args_),
            values: this.sqlQuery.getValues(_args_),
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
   run(...args: SqlRunArgs<TDbClient, T["Params"]>): T["QueryResult"] {
      const [opts] = args;
      const { db, debug } = isSqlRunOptions(opts) ? opts : { db: opts };
      let queryConfig = undefined;
      try {
         queryConfig = this.getOptions(...args);
         if (debug) debug(Object.freeze(queryConfig));
         return db.prepare(queryConfig.sql).run(queryConfig.values);
      } catch (err) {
         console.error(err, "\n", queryConfig?.sql ?? "error building core");
         throw err;
      }
   }

   getAll(...args: SqlRunArgs<TDbClient, T["Params"]>): T["Row"][] {
      const [opts] = args;
      const { db, debug } = isSqlRunOptions(opts) ? opts : { db: opts };
      let queryConfig = undefined;
      try {
         queryConfig = this.getOptions(...args);
         if (debug) debug(Object.freeze(queryConfig));
         return db.prepare<unknown[] | object, T["Row"]>(queryConfig.sql).all(queryConfig.values);
      } catch (err) {
         console.error(err, "\n", queryConfig?.sql ?? "error building core");
         throw err;
      }
   }
}

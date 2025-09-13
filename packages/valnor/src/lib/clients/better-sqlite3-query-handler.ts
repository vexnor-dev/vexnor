import { isSqlRunOptions, RowOut, SqlRunArgs } from "../sql-types.js";
import type { Database, RunResult } from "better-sqlite3";
import { SqlQueryHandler } from "./sql-query-handler.js";
import type { QueryResult } from "pg";
import { SqlQuery } from "../sql-query.js";
import { PgQueryHandler } from "./pg-query-handler.js";

export class BetterSqlite3QueryHandler<
   T extends { Row: RowOut; Params: Record<string, unknown> | undefined; QueryResult: RunResult },
   TDbClient extends Database = Database,
> extends SqlQueryHandler<T, TDbClient> {
   resolveRows(): T["Row"][] {
      throw new Error("Method not supported: better-sqlite3 result doesn't include any rows");
   }

   /**
    * Executes the query and returns the result
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
         console.error(err, "\n", queryConfig?.text ?? "error building query");
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
         console.error(err, "\n", queryConfig?.text ?? "error building query");
         throw err;
      }
   }
}

// Extend the class type (in scope)
declare module "../sql-query.js" {
   interface SqlQuery<T extends { Row: RowOut; Params: Record<string, unknown> | undefined }> {
      readonly pg: PgQueryHandler<T & { QueryResult: QueryResult }>;
   }
}

Object.defineProperty(SqlQuery.prototype, "betterSqlite3", {
   get: function () {
      return new PgQueryHandler(this);
   },
});

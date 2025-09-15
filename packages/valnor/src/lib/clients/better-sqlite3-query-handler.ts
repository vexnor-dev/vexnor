import { isSqlRunOptions, RowOut, SqlRunArgs, SqlValuesArgs } from "../sql-types.js";
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

   getOptions(...args: SqlRunArgs<TDbClient, T["Params"]>) {
      // eslint-disable-next-line unused-imports/no-unused-vars
      const [_, params] = args;
      const _args_: SqlValuesArgs<T["Params"]> = [params] as SqlValuesArgs<T["Params"]>;
      let queryInput = undefined;
      try {
         queryInput = {
            sql: this.sqlQuery.getSql(..._args_),
            values: this.sqlQuery.getValues(..._args_),
         };
         return queryInput;
      } catch (err) {
         console.error(err, "\n", queryInput?.sql ?? "error building query");
         throw err;
      }
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
         console.error(err, "\n", queryConfig?.sql ?? "error building query");
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
         console.error(err, "\n", queryConfig?.sql ?? "error building query");
         throw err;
      }
   }
}

const plugin = "sqlite";

// Extend the class type (in scope)
declare module "../sql-query.js" {
   interface SqlQuery<T extends { Row: RowOut; Params: Record<string, unknown> | undefined }> {
      readonly [plugin]: PgQueryHandler<T & { QueryResult: QueryResult }>;
   }
}

Object.defineProperty(SqlQuery.prototype, plugin, {
   get: function () {
      return new PgQueryHandler(this);
   },
});

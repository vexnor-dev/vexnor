import { SqlQuery } from "../sql-query.js";
import { isSqlRunOptions, RowOut, SqlRunArgs } from "../sql-types.js";
import { AsyncQueryHandler } from "./async-query-handler.js";
import type { QueryResult } from "pg";

type PgClient = {
   query: (queryConfig: { text: string; values: unknown[] }) => Promise<QueryResult>;
};

export class PgQueryHandler<
   T extends { Row: RowOut; Params: Record<string, unknown> | undefined; QueryResult: QueryResult },
   TDbClient extends PgClient = PgClient,
> extends AsyncQueryHandler<T, TDbClient> {
   constructor(readonly sqlQuery: SqlQuery<T>) {
      super(sqlQuery);
   }

   resolveRows(result: T["QueryResult"]): T["Row"][] {
      return result.rows;
   }

   /**
    * Executes the query and returns the result
    * @param args
    */
   async run(...args: SqlRunArgs<TDbClient, T["Params"]>): Promise<T["QueryResult"]> {
      const [opts] = args;
      const { db, debug } = isSqlRunOptions(opts) ? opts : { db: opts };
      let queryInput = undefined;
      try {
         queryInput = this.getOptions(...args);
         if (debug) debug(Object.freeze(queryInput));
         const { text, values } = queryInput;
         return await db.query({ text, values });
      } catch (err) {
         console.error(err, "\n", queryInput?.text ?? "error building query");
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

Object.defineProperty(SqlQuery.prototype, "pg", {
   get: function () {
      return new PgQueryHandler(this);
   },
});

import { AsyncQueryHandler, Params, RowOut, SqlQuery, SqlRunArgs } from "valnor";
import type { QueryResult } from "pg";

export type PostgresClient = {
   query: (queryConfig: { text: string; values: unknown[] }) => Promise<QueryResult>;
};

export class PostgresQueryHandler<T extends { Row: RowOut; Params?: Params }> extends AsyncQueryHandler<{
   Row: T["Row"];
   Params: T["Params"];
   QueryResult: QueryResult<T["Row"]>;
   QueryClient: PostgresClient;
}> {
   constructor(readonly sqlQuery: SqlQuery<T>) {
      super(sqlQuery);
   }

   getOptions(args: SqlRunArgs<PostgresClient, T["Params"]>) {
      let queryInput = undefined;
      try {
         queryInput = {
            text: this.sqlQuery.getText(args, (index) => `$${index + 1}`),
            values: this.sqlQuery.getValues(args),
         };
         return queryInput;
      } catch (err) {
         console.error(err, "\n", queryInput?.text ?? "error building core");
         throw err;
      }
   }

   resolveRows(result: QueryResult<T["Row"]>): T["Row"][] {
      return result.rows;
   }

   /**
    * Executes the core and returns the result
    * @param args
    */
   async run(args: SqlRunArgs<PostgresClient, T["Params"]>): Promise<QueryResult<T["Row"]>> {
      const { db, options: { debug } = {} } = args;
      let queryInput = undefined;
      try {
         queryInput = this.getOptions(args);
         if (debug) debug(Object.freeze(queryInput));
         const { text, values } = queryInput;
         return await db.query({ text, values });
      } catch (err) {
         console.error(err, "\n", queryInput?.text ?? "error building core");
         throw err;
      }
   }
}

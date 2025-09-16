import {
   AsyncQueryHandler,
   isSqlRunOptions,
   QueryInput,
   RowOut,
   SqlQuery,
   SqlRunArgs,
   SqlValuesArgs,
} from "valnor/core";
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

   getOptions(...args: SqlRunArgs<TDbClient, T["Params"]>): QueryInput {
      // eslint-disable-next-line unused-imports/no-unused-vars
      const [_, params] = args;
      const _args_: SqlValuesArgs<T["Params"]> = [params] as SqlValuesArgs<T["Params"]>;
      let queryInput = undefined;
      try {
         queryInput = {
            sql: this.sqlQuery.getSql(..._args_),
            text: this.sqlQuery.getText(..._args_),
            values: this.sqlQuery.getValues(..._args_),
         };
         return queryInput;
      } catch (err) {
         console.error(err, "\n", queryInput?.text ?? "error building query");
         throw err;
      }
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

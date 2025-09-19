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
   T extends { Row: RowOut; Params: Record<string, unknown> | undefined },
> extends AsyncQueryHandler<{
   Row: T["Row"];
   Params: T["Params"];
   QueryResult: QueryResult<T["Row"]>;
   Client: PgClient;
}> {
   constructor(readonly sqlQuery: SqlQuery<{ Row: T["Row"]; Params: T["Params"] }>) {
      super(sqlQuery);
   }

   getOptions(...args: SqlRunArgs<PgClient, T["Params"]>): QueryInput {
      // eslint-disable-next-line unused-imports/no-unused-vars
      const [_, params] = args;
      const _args_: SqlValuesArgs<T["Params"]> = { params } as SqlValuesArgs<T["Params"]>;
      let queryInput = undefined;
      try {
         queryInput = {
            sql: this.sqlQuery.getSql(_args_),
            text: this.sqlQuery.getText(_args_),
            values: this.sqlQuery.getValues(_args_),
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
   async run(...args: SqlRunArgs<PgClient, T["Params"]>): Promise<QueryResult<T["Row"]>> {
      const [opts] = args;
      const { db, debug } = isSqlRunOptions(opts) ? opts : { db: opts };
      let queryInput = undefined;
      try {
         queryInput = this.getOptions(...args);
         if (debug) debug(Object.freeze(queryInput));
         const { text, values } = queryInput;
         return await db.query({ text, values });
      } catch (err) {
         console.error(err, "\n", queryInput?.text ?? "error building core");
         throw err;
      }
   }
}

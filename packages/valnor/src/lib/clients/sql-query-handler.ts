import { SqlQuery } from "../sql-query.js";
import { QueryInput, RowOut, SqlRunArgs, SqlValuesArgs } from "../sql-types.js";

export abstract class SqlQueryHandler<
   T extends { Row: RowOut; Params: Record<string, unknown> | undefined; QueryResult: object },
   TDbClient extends object,
> {
   constructor(public readonly sqlQuery: SqlQuery<T>) {}

   abstract resolveRows(res: T["QueryResult"]): T["Row"][];

   getOptions(...args: SqlRunArgs<TDbClient, T["Params"]>): QueryInput {
      // eslint-disable-next-line unused-imports/no-unused-vars
      const [_, params] = args;
      const _args_: SqlValuesArgs<T["Params"]> = [params] as SqlValuesArgs<T["Params"]>;
      let queryInput = undefined;
      try {
         queryInput = {
            sql: this.sqlQuery.sql(..._args_),
            text: this.sqlQuery.text(..._args_),
            values: this.sqlQuery.values(..._args_),
         };
         return queryInput;
      } catch (err) {
         console.error(err, "\n", queryInput?.text ?? "error building query");
         throw err;
      }
   }
}

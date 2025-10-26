import { AsyncQueryHandler, Params, RowOut, SqlQuery, SqlRunArgs } from "valnor";
import { IResult, Request } from "mssql";
import { MssqlTokenizer } from "./mssql-tokenizer.js";
import { MssqlParamFormatter } from "./mssql-param-formatter.js";

export class MssqlQueryHandler<T extends { Row: RowOut; Params?: Params }> extends AsyncQueryHandler<{
   Row: T["Row"];
   Params?: T["Params"];
   QueryResult: IResult<T["Row"]>;
   QueryClient: Request;
}> {
   constructor(readonly sqlQuery: SqlQuery<{ Row: T["Row"]; Params: T["Params"] }>) {
      super(sqlQuery);
   }

   getOptions(args: SqlRunArgs<Request, T["Params"]>) {
      let queryInput = undefined;
      try {
         // Create a new options object to inject the tokenizer
         const newArgs: SqlRunArgs<Request, T["Params"]> = {
            ...args,
            options: {
               ...args.options,
               tokenizer: new MssqlTokenizer(this.sqlQuery.name),
            },
         };

         queryInput = {
            sql: this.sqlQuery.getText(newArgs, MssqlParamFormatter),
            params: this.sqlQuery.getValues(newArgs),
         };
         return queryInput;
      } catch (err) {
         console.error(err, "\n", queryInput?.sql ?? "error building query");
         throw err;
      }
   }

   resolveRows(result: IResult<T["Row"]>): T["Row"][] {
      return result.recordset;
   }

   /**
    * Executes the query and returns the result
    * @param args
    */
   async run(args: SqlRunArgs<Request, T["Params"]>): Promise<IResult<T["Row"]>> {
      const { db, options: { debug } = {} } = args;
      let queryInput = undefined;
      try {
         queryInput = this.getOptions(args);
         if (debug) debug(Object.freeze(queryInput));
         const { sql, params } = queryInput;

         for (let i = 0; i < params.length; i++) {
            db.input(`param_${i}`, params[i]);
         }

         return await db.query(sql);
      } catch (err) {
         console.error(err, "\n", queryInput?.sql ?? "error building query");
         throw err;
      }
   }
}

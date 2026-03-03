import { SqlQueryHandler, SqlInputArgs, SqlQuery, SqlRunArgs } from "valnor";
import { IResult, Promise, Request } from "mssql";
import { MssqlTokenizer } from "./mssql-tokenizer.js";
import { MssqlParamFormatter } from "./mssql-param-formatter.js";
import "valnor/testing";

export class MssqlQueryHandler<T extends { Params?: unknown; Row?: unknown }> extends SqlQueryHandler<{
   Row: T["Row"];
   Params: T["Params"];
   QueryResult: IResult<T["Row"]>;
   Connection: Request;
}> {
   constructor(readonly query: SqlQuery<{ Row: T["Row"]; Params: T["Params"] }>) {
      super(query);
   }

   getOptions(args: SqlRunArgs<{ Connection: Request; Params: T["Params"] }>) {
      let queryInput = undefined;
      try {
         const newArgs: SqlInputArgs<T["Params"]> = {
            ...args,
            options: {
               ...args.options,
               tokenizer: new MssqlTokenizer(this.query.id),
               paramFormat: MssqlParamFormatter,
               dialect: "tsql",
            },
         };

         queryInput = this.query.getSql(newArgs);
         return queryInput;
      } catch (err) {
         console.error(err, "\n", queryInput?.text ?? "error building query");
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
   async run<Args extends SqlRunArgs<{ Connection: Request; Params: T["Params"] }>>(
      args: Args,
   ): Promise<IResult<T["Row"]>> {
      const { db, options: { debug } = {} } = args;
      let queryInput = undefined;
      try {
         queryInput = this.getOptions(args);
         if (debug) debug(Object.freeze(queryInput));
         const { text, values } = queryInput;

         for (let i = 0; i < values.length; i++) {
            (await db).input(`param_${i}`, values[i]);
         }

         return await (await db).query(text);
      } catch (err) {
         console.error(err, "\n", queryInput?.text ?? "error building query");
         throw err;
      }
   }
}

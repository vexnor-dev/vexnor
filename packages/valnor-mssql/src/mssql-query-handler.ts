import { SqlQueryHandler, SqlInputArgs, SqlQuery, SqlRunArgs, SqlRunError } from "valnor";
import { IResult, Request } from "mssql";
import { defaultQueryOptions } from "./default-query-options.js";

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
               ...defaultQueryOptions,
               ...args.options,
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
      const queryInput = this.getOptions(args);
      if (debug) debug(Object.freeze(queryInput));
      const { values, text } = queryInput;
      for (let i = 0; i < values.length; i++) {
         (await db).input(`param_${i}`, values[i]);
      }

      try {
         return await (await db).query(text);
      } catch (err) {
         throw new SqlRunError(`Error running MSSQL query.\n${text}`, this, { cause: err }, text);
      }
   }
}

import { SqlQueryHandler, SqlInputArgs, SqlQuery, SqlRunArgs, SqlRunError } from "vexnor";
import mssql, { IResult, Request } from "mssql";
const { TYPES } = mssql;
import { defaultQueryOptions } from "./default-query-options.js";

export class MssqlQueryHandler<T extends { Params?: unknown; Row?: unknown }> extends SqlQueryHandler<
   Pick<T, "Row" | "Params"> & {
      QueryResult: IResult<T["Row"]>;
      Connection: Request;
   }
> {
   constructor(readonly query: SqlQuery<Pick<T, "Row" | "Params">>) {
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
         throw new SqlRunError(`Error building mssql query '${this.query.id}'`, this.query, { cause: err });
      }
   }

   resolveRows(result: IResult<T["Row"]>): T["Row"][] {
      return result.recordset;
   }

   /**
    * Executes the query and returns the raw `mssql` `IResult`.
    *
    * You typically don't call this directly — use `getAll()`, `getOneRequired()`,
    * or `getOneOptional()` instead. Call `run()` when you need access to the full
    * `IResult` object (e.g. `recordsets`, `rowsAffected`).
    *
    * @param args - Database connection and query parameters.
    */
   async run<Args extends SqlRunArgs<{ Connection: Request; Params: T["Params"] }>>(
      args: Args,
   ): Promise<IResult<T["Row"]>> {
      const { db, options: { debug } = {} } = args;
      const queryInput = this.getOptions(args);
      if (debug) debug(Object.freeze(queryInput));
      const { values, text } = queryInput;
      for (let i = 0; i < values.length; i++) {
         const value = values[i];
         if (value instanceof Uint8Array) {
            (await db).input(`param_${i}`, TYPES.VarBinary, Buffer.from(value));
         } else {
            (await db).input(`param_${i}`, value);
         }
      }

      try {
         return await (await db).query(text);
      } catch (err) {
         throw new SqlRunError(`Error running MSSQL query.\n${text}`, this, { cause: err }, text);
      }
   }
}

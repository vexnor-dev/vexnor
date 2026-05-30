import { SqlQueryHandler, SqlInputArgs, SqlQuery, SqlRunArgs, SqlRunError, isRemoteClient, RemoteClient } from "vexnor";
import type { IResult, Request } from "mssql";
import { defaultQueryOptions } from "./default-query-options.js";
import pkg from "../package.json" with { type: "json" };

export const PLUGIN_NAME = pkg.name;

export type MssqlClient = Request | RemoteClient;

export class MssqlQueryHandler<T extends { Params?: unknown; Row?: unknown }> extends SqlQueryHandler<
   Pick<T, "Row" | "Params"> & {
      QueryResult: IResult<T["Row"]>;
      Connection: MssqlClient;
   }
> {
   constructor(readonly query: SqlQuery<Pick<T, "Row" | "Params">>) {
      super(query);
   }

   getOptions(args: SqlRunArgs<{ Connection: MssqlClient; Params: T["Params"] }>) {
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

   deserialize(result: IResult<T["Row"]>, remote: boolean): IResult<T["Row"]> {
      const rows = this.deserializeRows(this.resolveRows(result), remote);
      return { ...result, recordset: rows as IResult<T["Row"]>["recordset"] };
   }

   /**
    * Executes the query and returns the raw `mssql` `IResult`.
    *
    * You typically don't call this directly — use `getAll()`, `getOneRequired()`,
    * or `getOneOptional()` instead. Call `execute()` when you need access to the full
    * `IResult` object (e.g. `recordsets`, `rowsAffected`).
    *
    * @param args - Database connection and query parameters.
    */
   async execute<Args extends SqlRunArgs<{ Connection: MssqlClient; Params: T["Params"] }>>(
      args: Args,
   ): Promise<IResult<T["Row"]>> {
      const { db, options: { debug } = {} } = args;
      const resolvedDb = await db;

      if (isRemoteClient(resolvedDb)) {
         const hash = await this.query.hash;
         const params = (args as { params?: Record<string, unknown> }).params ?? {};
         return resolvedDb.remoteExecute<IResult<T["Row"]>>({ plugin: PLUGIN_NAME, hash, params });
      }

      const request = resolvedDb as Request;
      const queryInput = this.getOptions(args);
      if (debug) debug(Object.freeze(queryInput));
      const { values, text } = queryInput;

      const { default: mssql } = await import("mssql");
      const { TYPES } = mssql;

      for (let i = 0; i < values.length; i++) {
         const value = values[i];
         if (value instanceof Uint8Array) {
            request.input(`param_${i}`, TYPES.VarBinary, Buffer.from(value));
         } else {
            request.input(`param_${i}`, value);
         }
      }

      try {
         return await request.query(text);
      } catch (err) {
         throw new SqlRunError(`Error running MSSQL query.\n${text}`, this, { cause: err }, text);
      }
   }
}

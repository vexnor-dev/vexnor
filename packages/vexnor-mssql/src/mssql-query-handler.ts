import {
   SqlQueryHandler,
   SqlInputArgs,
   SqlQuery,
   SqlRunArgs,
   SqlRunError,
   SqlErrorCode,
   deserialize,
   ok,
   RemoteClient,
} from "vexnor";

// MSSQL transient error numbers and codes safe to retry
const RETRYABLE_MSSQL_NUMBERS = new Set([1205]); // deadlock
const RETRYABLE_MSSQL_CODES = new Set(["ECONNRESET", "ETIMEOUT", "ESOCKET"]);

function isRetryableMssqlError(err: unknown): boolean {
   if (typeof err !== "object" || err === null) return false;
   const e = err as { code?: string; number?: number };
   return (
      (e.code !== undefined && RETRYABLE_MSSQL_CODES.has(e.code)) ||
      (e.number !== undefined && RETRYABLE_MSSQL_NUMBERS.has(e.number))
   );
}
import type { IResult, Request } from "mssql";
import { defaultQueryOptions } from "./default-query-options.js";
import pkg from "../package.json" with { type: "json" };

export const PLUGIN_NAME = pkg.name;

export type MssqlClient = Request;

export class MssqlQueryHandler<T extends { Params?: unknown; Row?: unknown }> extends SqlQueryHandler<
   Pick<T, "Row" | "Params"> & {
      Connection: MssqlClient | RemoteClient;
      QueryResult: IResult<T["Row"]>;
   }
> {
   constructor(readonly query: SqlQuery<Pick<T, "Row" | "Params">>) {
      super(query, { pluginName: PLUGIN_NAME });
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
         throw new SqlRunError(`Error building mssql query '${this.query.id}'`, this.query, {
            cause: err,
            code: SqlErrorCode.QUERY_BUILD_FAILED,
         });
      }
   }

   resolveRows(result: IResult<T["Row"]>): T["Row"][] {
      ok(result.recordsets, `MSSQL query result doesn't have a 'recordsets' array.`);
      ok(result.recordsets[0], `MSSQL query result doesn't have any results in 'recordsets' array.`);
      return result.recordsets[0] ?? [];
   }

   deserialize<TResult = IResult<T["Row"]>>(result: TResult, isRemoteClient: boolean): TResult {
      ok(isQueryResult(result), `MSSQL query result should be an object with a 'recordsets' property.`);
      const rowSchema = this.getRowSchema(isRemoteClient);
      const { recordsets } = result;
      if (!Array.isArray(recordsets)) {
         return result;
      }

      for (let i = 0; i < recordsets.length; i++) {
         const recordset = recordsets[i];
         if (!recordset || !Array.isArray(recordset) || recordset.length <= 0) {
            continue;
         }

         for (let k = 0; k < recordset.length; k++) {
            recordset[k] = deserialize(recordset[k]!, rowSchema)!;
         }
      }

      result.recordset = (recordsets[0] ?? []) as IResult<T["Row"]>["recordset"];
      return result;
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
   async execute<TResult = IResult<T["Row"]>>(
      args: SqlRunArgs<{ Connection: MssqlClient; Params: T["Params"] }>,
   ): Promise<TResult> {
      const { db, options: { debug } = {} } = args;
      const request = await db;
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
         const result = await request.query(text);
         // result.recordset.splice(0);
         return result as TResult;
      } catch (err) {
         throw new SqlRunError(`Error running MSSQL query.\n${text}`, this, {
            cause: err,
            sql: text,
            code: isRetryableMssqlError(err)
               ? SqlErrorCode.QUERY_RETRYABLE_FAILURE
               : SqlErrorCode.QUERY_EXECUTION_FAILED,
            retryable: isRetryableMssqlError(err),
         });
      }
   }
}

function isQueryResult<T extends object>(value: unknown): value is IResult<T> {
   return typeof value === "object" && value !== null && "recordsets" in value && Array.isArray(value.recordsets);
}

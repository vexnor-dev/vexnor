import {
   SqlQueryHandler,
   SqlInputArgs,
   SqlQuery,
   SqlRunArgs,
   SqlRunError,
   SqlErrorCode,
   deserialize,
   ok,
   RemoteClient, getQueryName,
   type QueryMeta,
} from "@vexnor/core";

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
import type { ConnectionPool, IResult, Request } from "mssql";
import { defaultQueryOptions } from "./default-query-options.js";
import pkg from "../package.json" with { type: "json" };

export type MssqlResult<T> = IResult<T>;

export const PLUGIN_NAME = pkg.name;

export type MssqlClient = Request | ConnectionPool;

export class MssqlQueryHandler<T extends { Params?: unknown; Row?: unknown }> extends SqlQueryHandler<
   Pick<T, "Row" | "Params"> & {
      Connection: MssqlClient | RemoteClient;
      Read: MssqlResult<T["Row"]>;
      Write: MssqlResult<T["Row"]>;
   }
> {
   constructor(readonly source: SqlQuery<Pick<T, "Row" | "Params">>) {
      super(source, { pluginName: PLUGIN_NAME });
   }

   isReadResult(result: unknown): result is MssqlResult<T["Row"]> {
      return (
         typeof result === "object" && result !== null && "recordsets" in result && Array.isArray(result.recordsets)
      );
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
         queryInput = this.source.getSql(newArgs);
         return queryInput;
      } catch (err) {
         throw new SqlRunError(`Error building mssql query '${this.source.id}'`, this.source, {
            cause: err,
            code: SqlErrorCode.QUERY_BUILD_FAILED,
         });
      }
   }

   resolveRows(result: MssqlResult<T["Row"]>): T["Row"][] {
      ok(Array.isArray(result.recordsets), `MSSQL query result doesn't have a 'recordsets' array.`);
      ok(result.recordsets[0], `MSSQL query result doesn't have any results in 'recordsets' array.`);
      return (result.recordsets[0] as T["Row"][]) ?? [];
   }

   deserialize<TResult = MssqlResult<T["Row"]>>(result: TResult, isRemoteClient: boolean): TResult {
      ok(this.isReadResult(result), `MSSQL query result should be an object with a 'recordsets' property.`);
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

      result.recordset = (recordsets[0] ?? []) as MssqlResult<T["Row"]>["recordset"];
      return result;
   }

   serialize<TResult extends MssqlResult<T["Row"]> = MssqlResult<T["Row"]>>(value: TResult): TResult {
      const result = value as MssqlResult<T["Row"]>;
      const { recordsets, rowsAffected } = result;
      return { recordsets, rowsAffected } as TResult;
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
   async execute(args: SqlRunArgs<{ Connection: MssqlClient; Params: T["Params"] }>, _mode?: unknown, meta?: QueryMeta) {
      const { db, options: { debug } = {} } = args;
      const resolved = await db;
      const request =
         "request" in resolved && typeof resolved.request === "function"
            ? (resolved as ConnectionPool).request()
            : (resolved as Request);
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
         const result: IResult<T["Row"]> = await request.query(text);
         if (meta) { meta.sql = text; meta.params = values; }
         return result;
      } catch (err) {
         const queryName = await getQueryName(this.source);
         throw new SqlRunError(`Error running MSSQL query '${queryName ?? this.source.id}' at ${this.source.location}.`, this.source, {
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

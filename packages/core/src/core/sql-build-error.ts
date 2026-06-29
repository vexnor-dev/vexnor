import { SqlErrorCode } from "#src/core/sql-error-code.js";

/**
 * Thrown when a SQL query fails to build — e.g. a missing param value,
 * unsupported token, or invalid query structure.
 * `code` defaults to {@link SqlErrorCode.QUERY_BUILD_FAILED} but can be
 * overridden (e.g. {@link SqlErrorCode.PARAM_VALIDATION_FAILED}).
 */
export class SqlBuildError extends Error {
   readonly code: SqlErrorCode;

   constructor(
      public readonly message: string,
      public readonly options?: ErrorOptions & { code?: SqlErrorCode },
   ) {
      super(message, options);
      this.name = "SqlBuildError";
      this.code = options?.code ?? SqlErrorCode.QUERY_BUILD_FAILED;
   }
}

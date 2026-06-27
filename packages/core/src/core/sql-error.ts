import { SqlErrorCode } from "#src/core/sql-error-code.js";

/**
 * Thrown for registry-level errors — unknown query hash, startup validation failures.
 * `code` identifies the specific failure.
 */
export class SqlError extends Error {
   readonly code: SqlErrorCode;

   constructor(
      public readonly message: string,
      public readonly options?: ErrorOptions & { code?: SqlErrorCode },
   ) {
      super(message, options);
      this.name = "SqlError";
      this.code = options?.code ?? SqlErrorCode.QUERY_NOT_FOUND;
   }
}

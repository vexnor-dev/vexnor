import { SqlErrorCode } from "#/core/sql-error-code.js";

export type SqlRunErrorOptions = ErrorOptions & {
   params?: Record<string, unknown>;
   queryName?: string;
   sql?: string;
   code: SqlErrorCode;
   retryable?: boolean;
};

/** Minimal query identity needed to construct a {@link SqlRunError}. */
export type SqlRunQueryRef = { id: string; location: string | null };

/**
 * Thrown when a SQL query fails during execution.
 *
 * `queryId` identifies which query failed. `sql` contains the built SQL text
 * when available — useful for logging the exact statement that caused the error.
 * `code` is a machine-readable {@link SqlErrorCode} for programmatic handling.
 * `retryable` indicates whether the failure is transient and safe to retry.
 */
export class SqlRunError extends Error {
   readonly queryId: string;
   readonly queryLocation: string | null = null;
   readonly queryName: string | null = null;
   readonly sql: string | null = null;
   readonly params?: Record<string, unknown> | null = null;
   readonly code: SqlErrorCode;
   readonly retryable: boolean;
   private readonly _message: string;

   constructor(message: string, query: SqlRunQueryRef, options: SqlRunErrorOptions) {
      super(message + (options?.cause ? `. (${options.cause})` : ""), { cause: options.cause });
      this._message = message;
      this.cause = options?.cause ?? null;
      this.name = "SqlRunError";
      this.queryId = query.id;
      this.queryLocation = query.location;
      this.queryName = options?.queryName ?? query.location;
      this.sql = options?.sql ?? null;
      this.params = options?.params ?? null;
      this.code = options.code;
      this.retryable = options?.retryable ?? false;
   }

   /**
    * Returns a new `SqlRunError` with the given options merged over the current ones.
    * Use this to enrich an error with additional context (e.g. `queryName`, `retryable`)
    * without mutating the original.
    */
   withOptions(overrides: Partial<SqlRunErrorOptions> & { code?: SqlErrorCode }): SqlRunError {
      return new SqlRunError(
         this._message,
         { id: this.queryId, location: this.queryLocation },
         {
            cause: this.cause ?? undefined,
            queryName: overrides.queryName ?? this.queryName ?? undefined,
            sql: overrides.sql ?? this.sql ?? undefined,
            code: overrides.code ?? this.code,
            retryable: overrides.retryable ?? this.retryable,
            params: overrides.params ?? this.params ?? undefined,
         },
      );
   }
}

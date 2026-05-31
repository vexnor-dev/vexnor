import { SqlQueryAny } from "#/core/query/sql-query.js";

export type SqlRunErrorOptions = ErrorOptions & {
   params?: Record<string, unknown>;
   queryName?: string;
   sql?: string;
};

/**
 * Thrown when a SQL query fails during execution.
 *
 * `queryId` identifies which query failed. `sql` contains the built SQL text
 * when available — useful for logging the exact statement that caused the error.
 */
export class SqlRunError extends Error {
   readonly queryId: string;
   readonly queryLocation: string | null = null;
   readonly queryName: string | null = null;
   readonly sql: string | null = null;
   readonly params?: Record<string, unknown> | null = null;

   constructor(
      message: string,
      query: SqlQueryAny,
      public readonly options?: SqlRunErrorOptions,
   ) {
      super(message + (options?.cause ? `. (${options.cause})` : ""), options);
      this.cause = options?.cause ?? null;
      this.name = "SqlRunError";
      this.queryId = query.id;
      this.queryLocation = query.location;
      this.queryName = options?.queryName ?? query.location;
      this.sql = options?.sql ?? null;
      this.params = options?.params ?? null;
   }
}

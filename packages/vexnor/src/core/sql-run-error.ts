import { SqlQueryAny } from "#/core/query/sql-query.js";

/**
 * Thrown when a SQL query fails during execution.
 *
 * `queryId` identifies which query failed. `sql` contains the built SQL text
 * when available — useful for logging the exact statement that caused the error.
 */
export class SqlRunError extends Error {
   readonly queryId: string;
   readonly sql: string | null;

   constructor(
      public readonly message: string,
      query: SqlQueryAny,
      public readonly options: ErrorOptions,
      sql?: string,
   ) {
      super(message, options);
      this.queryId = query.id;
      this.sql = sql ?? null;
   }
}

import { SqlQueryAny } from "#/core/query/sql-query.js";

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

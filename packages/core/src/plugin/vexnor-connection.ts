import type { SqlQueryPipeline } from "#src/execution/sql-query-pipeline.js";

export class VexnorConnection<T extends { Connection: unknown; Context: Record<string, unknown> }> {
   /**
    * Phantom type field in contravariant position — never assigned at runtime.
    * Allows TypeScript to enforce that the pipeline's context is a subset of
    * the query's params at the `db` call site: `TParams extends TContext`.
    */
   declare readonly _context: (context: T["Context"]) => void;

   constructor(
      private readonly underlying: T["Connection"],
      private readonly closeFn: (connection: T["Connection"]) => PromiseLike<void> | void,
      readonly pipeline: SqlQueryPipeline<{ Context: T["Context"] }> | null = null,
   ) {}

   get db(): T["Connection"] {
      return this.underlying;
   }

   async close(): Promise<void> {
      if (!this.closeFn) return;

      await this.closeFn(this.underlying);
   }
}

export function isVexnorConnection<T extends { Connection: unknown; Context: Record<string, unknown> }>(
   value: unknown,
): value is VexnorConnection<T> {
   return value instanceof VexnorConnection;
}

/**
 * Wraps an existing connection or pool with an optional `SqlQueryPipeline`.
 *
 * The pipeline fires on every direct query execution against this connection.
 * Runtime context is inferred from `ctx()` parameters supplied in query `params`.
 *
 * @example
 * const db = connect<{ userId: string }>(pool, { pipeline });
 *
 * findAccounts.postgres.all({ db, params: { userId: getActiveUser() } });
 */
export function connect<TContext extends Record<string, unknown>, TConnection = unknown>(
   db: TConnection,
   options?: { pipeline?: SqlQueryPipeline<{ Context: TContext }> },
): VexnorConnection<{ Connection: TConnection; Context: TContext }> {
   return new VexnorConnection<{ Connection: TConnection; Context: TContext }>(
      db,
      () => {
         throw new Error("No close function provided for this feature.");
      },
      options?.pipeline ?? null,
   );
}

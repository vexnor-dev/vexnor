/** Thrown when a SQL query fails to build — e.g. a missing param value, unsupported token, or invalid query structure. */
export class SqlMetaError extends Error {
   constructor(
      public readonly message: string,
      public readonly options?: ErrorOptions,
   ) {
      super(message, options);
   }
}

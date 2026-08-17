export class SchemaConfigurationError extends Error {
   readonly code = "INVALID_CONFIGURATION";

   constructor(message: string) {
      super(message);
      this.name = "SchemaConfigurationError";
   }
}

export class MissingRelationshipPathError extends Error {
   readonly code = "MISSING_RELATIONSHIP_PATH";

   constructor(message: string) {
      super(message);
      this.name = "MissingRelationshipPathError";
   }
}

export class InvalidLocalQueryParametersError extends Error {
   readonly code = "INVALID_QUERY_PARAMETERS";

   constructor(message: string) {
      super(message);
      this.name = "InvalidLocalQueryParametersError";
   }
}

export class LocalDataSessionBudgetError extends Error {
   readonly code = "BUDGET_EXHAUSTED";

   constructor(message: string) {
      super(message);
      this.name = "LocalDataSessionBudgetError";
   }
}

export class LocalDataSessionTimeoutError extends Error {
   readonly code = "QUERY_TIMEOUT";

   constructor(message: string) {
      super(message);
      this.name = "LocalDataSessionTimeoutError";
   }
}

export class LocalDataSessionCancellationError extends Error {
   readonly code = "QUERY_CANCELLED";

   constructor(message: string) {
      super(message);
      this.name = "LocalDataSessionCancellationError";
   }
}

export class LocalDataSessionClosedError extends Error {
   readonly code = "SESSION_CLOSED";

   constructor(message: string) {
      super(message);
      this.name = "LocalDataSessionClosedError";
   }
}

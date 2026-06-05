/**
 * Machine-readable error codes for all vexnor errors.
 *
 * Follows the `{SUBJECT}_{ERROR}` convention.
 * Implemented as a `const enum` so values inline at compile time —
 * no runtime object, works in both Node.js and browser bundles.
 */
export const enum SqlErrorCode {
   /** Query SQL could not be built — missing param, invalid token, unsupported structure. */
   QUERY_BUILD_FAILED = "QUERY_BUILD_FAILED",

   /** Query execution failed — driver error, connection failure, etc. */
   QUERY_EXECUTION_FAILED = "QUERY_EXECUTION_FAILED",

   QUERY_PARAMETERS_INVALID = "QUERY_PARAMETERS_INVALID",

   /** Query exceeded the configured timeout. */
   QUERY_TIMEOUT = "QUERY_TIMEOUT",

   /** Query was rejected because it is not registered in the QueryRegistry. */
   QUERY_NOT_FOUND = "QUERY_NOT_FOUND",

   /** Query was rejected by an authorization hook, or has no hook registered. */
   QUERY_NOT_AUTHORIZED = "QUERY_NOT_AUTHORIZED",

   /** Query was rejected because the rate limit or concurrency limit was exceeded. */
   QUERY_RATE_LIMITED = "QUERY_RATE_LIMITED",

   /** Query failed with a transient driver error and may be retried. */
   QUERY_RETRYABLE_FAILURE = "QUERY_RETRYABLE_FAILURE",

   /** Param value failed runtime validation rules. */
   PARAM_VALIDATION_FAILED = "PARAM_VALIDATION_FAILED",

   /** Registry startup check failed — authorized queries exist but no hook is registered. */
   REGISTRY_NOT_AUTHORIZED = "REGISTRY_NOT_AUTHORIZED",
}

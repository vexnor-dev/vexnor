import { SqlError, SqlRunError } from "@vexnor/core/execution";
import type { Context } from "hono";
import { SqlErrorCode } from "@vexnor/core";

type ErrorStatus = 400 | 403 | 429 | 500 | 503 | 504;

export const SQL_ERROR_STATUS: Record<SqlErrorCode, ErrorStatus> = {
   QUERY_NOT_FOUND: 400,
   QUERY_BUILD_FAILED: 400,
   PARAM_VALIDATION_FAILED: 400,
   QUERY_NOT_AUTHORIZED: 403,
   REGISTRY_NOT_AUTHORIZED: 403,
   QUERY_RATE_LIMITED: 429,
   QUERY_EXECUTION_FAILED: 500,
   QUERY_RETRYABLE_FAILURE: 503,
   QUERY_TIMEOUT: 504,
   QUERY_PARAMETERS_INVALID: 400,
   CONNECTION_NOT_VALID: 500,
};

export type DbErrorResponse =
   | { error: string; code: string; status: ErrorStatus }
   | { error: string; status: 500 };

export function toDbErrorResponse(err: unknown): DbErrorResponse {
   if (err instanceof SqlRunError || err instanceof SqlError) {
      const status: ErrorStatus = SQL_ERROR_STATUS[err.code] ?? 500;
      return { error: err.message, code: err.code, status };
   }
   return { error: String(err), status: 500 };
}

export function handleDbError(c: Context, err: unknown) {
   const { status, ...body } = toDbErrorResponse(err);
   return c.json(body, status);
}

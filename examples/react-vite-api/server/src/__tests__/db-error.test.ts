import { describe, test, expect } from "vitest";
import { SqlRunError, SqlError } from "vexnor/registry";
import { toDbErrorResponse, SQL_ERROR_STATUS } from "../db-error.js";

const mockQuery = { id: "SqlQuery#1", location: null };

describe("SQL_ERROR_STATUS", () => {
   test("maps codes to correct statuses", () => {
      expect(SQL_ERROR_STATUS).toMatchInlineSnapshot(`
        {
          "PARAM_VALIDATION_FAILED": 400,
          "QUERY_BUILD_FAILED": 400,
          "QUERY_EXECUTION_FAILED": 500,
          "QUERY_NOT_AUTHORIZED": 403,
          "QUERY_NOT_FOUND": 400,
          "QUERY_PARAMETERS_INVALID": 400,
          "QUERY_RATE_LIMITED": 429,
          "QUERY_RETRYABLE_FAILURE": 503,
          "QUERY_TIMEOUT": 504,
          "REGISTRY_NOT_AUTHORIZED": 403,
        }
      `);
   });
});

describe("toDbErrorResponse", () => {
   test("SqlRunError returns correct status and shape", () => {
      const err = new SqlRunError("query failed", mockQuery, {
         code: "QUERY_NOT_AUTHORIZED" as never,
      });
      expect(toDbErrorResponse(err)).toMatchInlineSnapshot(`
        {
          "code": "QUERY_NOT_AUTHORIZED",
          "error": "query failed",
          "status": 403,
        }
      `);
   });

   test("SqlError returns correct status and shape", () => {
      const err = new SqlError("not found", { code: "QUERY_NOT_FOUND" as never });
      expect(toDbErrorResponse(err)).toMatchInlineSnapshot(`
        {
          "code": "QUERY_NOT_FOUND",
          "error": "not found",
          "status": 400,
        }
      `);
   });

   test("unknown code falls back to 500", () => {
      const err = new SqlRunError("unknown", mockQuery, { code: "UNKNOWN_CODE" as never });
      expect(toDbErrorResponse(err)).toMatchInlineSnapshot(`
        {
          "code": "UNKNOWN_CODE",
          "error": "unknown",
          "status": 500,
        }
      `);
   });

   test("includes name and location from meta when provided", () => {
      const err = new SqlError("not found", { code: "QUERY_NOT_FOUND" as never });
      expect(toDbErrorResponse(err, { name: "selectAccounts", location: "shared/queries/postgres.ts:22:31" })).toMatchInlineSnapshot(`
        {
          "code": "QUERY_NOT_FOUND",
          "error": "not found",
          "location": "shared/queries/postgres.ts:22:31",
          "name": "selectAccounts",
          "status": 400,
        }
      `);
   });

   test("non-SqlError falls back to 500 with stringified message", () => {
      expect(toDbErrorResponse(new Error("boom"))).toMatchInlineSnapshot(`
        {
          "error": "Error: boom",
          "status": 500,
        }
      `);
   });

   test("non-Error value falls back to 500", () => {
      expect(toDbErrorResponse("something went wrong")).toMatchInlineSnapshot(`
        {
          "error": "something went wrong",
          "status": 500,
        }
      `);
   });
});

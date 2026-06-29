import { describe, it, expect, vi } from "vitest";
import { MssqlQueryHandler } from "#src/mssql-query-handler.js";
import { sql } from "#src/mssql-sql.js";
import { getQueryMeta, setQueryMeta } from "@vexnor/core";

const simpleQuery = sql`SELECT 1 as id`;

describe("MssqlQueryHandler.serialize() — meta forwarding", () => {
   it("extracts recordsets and rowsAffected, forwards meta", () => {
      const handler = new MssqlQueryHandler(simpleQuery.source);
      const input = {
         recordsets: [[{ id: 1 }]],
         recordset: [{ id: 1 }],
         rowsAffected: [1],
         output: {},
      };
      setQueryMeta(input, { sql: "SELECT 1", params: [], duration: 5 });
      const result = handler.serialize(input as never);
      expect(result).toMatchInlineSnapshot(`
        {
          "recordsets": [
            [
              {
                "id": 1,
              },
            ],
          ],
          "rowsAffected": [
            1,
          ],
        }
      `);
      const meta = getQueryMeta(result);
      expect(meta).toMatchInlineSnapshot(`
        {
          "duration": 5,
          "params": [],
          "sql": "SELECT 1",
        }
      `);
   });

   it("no meta on input → no meta on output", () => {
      const handler = new MssqlQueryHandler(simpleQuery.source);
      const input = {
         recordsets: [[{ id: 2 }]],
         recordset: [{ id: 2 }],
         rowsAffected: [1],
         output: {},
      };
      const result = handler.serialize(input as never);
      const meta = getQueryMeta(result);
      expect(meta).toMatchInlineSnapshot(`undefined`);
   });

   it("returns result as-is when recordsets is not an array", () => {
      const handler = new MssqlQueryHandler(simpleQuery.source);
      const input = { notRecordsets: true };
      const result = handler.serialize(input as never);
      expect(result).toMatchInlineSnapshot(`
        {
          "recordsets": undefined,
          "rowsAffected": undefined,
        }
      `);
   });
});

describe("MssqlQueryHandler.execute() — meta population", () => {
   it("populates meta.sql and meta.params on success", async () => {
      const handler = new MssqlQueryHandler(simpleQuery.source);
      const mockRequest = {
         input: vi.fn(),
         query: vi.fn().mockResolvedValue({
            recordsets: [[{ id: 1 }]],
            recordset: [{ id: 1 }],
            rowsAffected: [1],
            output: {},
         }),
      };
      const meta = {} as { sql?: string; params?: unknown[] };
      await handler.execute({ db: mockRequest as never }, undefined, meta);
      expect(meta.sql).toMatchInlineSnapshot(`
        "/* <query_0> */
        SELECT
          1 AS id /* </query_0> */"
      `);
      expect(meta.params).toMatchInlineSnapshot(`[]`);
   });
});

describe("isRetryableMssqlError — edge cases", () => {
   it("ESOCKET is retryable", async () => {
      const handler = new MssqlQueryHandler(simpleQuery.source);
      const mockRequest = {
         input: vi.fn(),
         query: vi.fn().mockRejectedValue({ code: "ESOCKET" }),
      };
      const err = await handler.execute({ db: mockRequest as never }).catch((e) => e);
      expect(err.retryable).toMatchInlineSnapshot(`true`);
   });

   it("false for unknown code", async () => {
      const handler = new MssqlQueryHandler(simpleQuery.source);
      const mockRequest = {
         input: vi.fn(),
         query: vi.fn().mockRejectedValue({ code: "UNKNOWN_CODE" }),
      };
      const err = await handler.execute({ db: mockRequest as never }).catch((e) => e);
      expect(err.retryable).toMatchInlineSnapshot(`false`);
   });

   it("false for non-Error (string)", async () => {
      const handler = new MssqlQueryHandler(simpleQuery.source);
      const mockRequest = {
         input: vi.fn(),
         query: vi.fn().mockRejectedValue("just a string"),
      };
      const err = await handler.execute({ db: mockRequest as never }).catch((e) => e);
      expect(err.retryable).toMatchInlineSnapshot(`false`);
   });
});

import { describe, expect, test, vi } from "vitest";
import type { IResult } from "mssql";
import { MssqlQueryHandler } from "#/mssql-query-handler.js";
import { sql } from "#/mssql-sql.js";
import { SqlRunError } from "@vexnor/core";

const simpleQuery = sql`SELECT 1 as id`;

describe("MssqlQueryHandler.isReadResult()", () => {
   test("returns true for valid IResult-like object", () => {
      const handler = new MssqlQueryHandler(simpleQuery.source);
      expect(handler.isReadResult({ recordsets: [[]], recordset: [], rowsAffected: [0], output: {} })).toBe(true);
   });

   test("returns false for null", () => {
      const handler = new MssqlQueryHandler(simpleQuery.source);
      expect(handler.isReadResult(null)).toBe(false);
   });

   test("returns false for non-object", () => {
      const handler = new MssqlQueryHandler(simpleQuery.source);
      expect(handler.isReadResult("string")).toBe(false);
   });

   test("returns false for object without recordsets", () => {
      const handler = new MssqlQueryHandler(simpleQuery.source);
      expect(handler.isReadResult({ rows: [] })).toBe(false);
   });

   test("returns false when recordsets is not an array", () => {
      const handler = new MssqlQueryHandler(simpleQuery.source);
      expect(handler.isReadResult({ recordsets: "not array" })).toBe(false);
   });
});

describe("MssqlQueryHandler.resolveRows()", () => {
   test("returns recordsets[0]", () => {
      const handler = new MssqlQueryHandler(simpleQuery.source);
      const result = { recordsets: [[{ id: 1 }]], recordset: [{ id: 1 }], rowsAffected: [1], output: {} } as never;
      expect(handler.resolveRows(result)).toMatchInlineSnapshot(`
        [
          {
            "id": 1,
          },
        ]
      `);
   });
});

describe("MssqlQueryHandler.deserialize()", () => {
   test("handles empty recordsets array", () => {
      const handler = new MssqlQueryHandler(simpleQuery.source);
      const result = { recordsets: [], recordset: [], rowsAffected: [0], output: {} } as unknown as IResult<unknown>;
      // Should not throw — recordsets is an array but empty
      const parsed = handler.deserialize(result, false);
      expect(parsed.recordset).toMatchInlineSnapshot(`[]`);
   });

   test("handles recordset with empty array inside", () => {
      const handler = new MssqlQueryHandler(simpleQuery.source);
      const result = { recordsets: [[]], recordset: [], rowsAffected: [0], output: {} } as unknown as IResult<unknown>;
      const parsed = handler.deserialize(result, false);
      expect(parsed.recordsets[0]).toMatchInlineSnapshot(`[]`);
   });

   test("handles null entries in recordsets", () => {
      const handler = new MssqlQueryHandler(simpleQuery.source);
      const result = { recordsets: [null], recordset: [], rowsAffected: [0], output: {} } as unknown as IResult<unknown>;
      const parsed = handler.deserialize(result, false);
      expect(parsed).toBeDefined();
   });
});

describe("MssqlQueryHandler.getOptions()", () => {
   test("returns query text and values", () => {
      const handler = new MssqlQueryHandler(simpleQuery.source);
      const result = handler.getOptions({ db: {} as never });
      expect(result.text).toContain("SELECT");
      expect(result.values).toMatchInlineSnapshot(`[]`);
   });
});

describe("MssqlQueryHandler.execute()", () => {
   test("uses Request directly when no .request() method", async () => {
      const handler = new MssqlQueryHandler(simpleQuery.source);
      const mockRequest = {
         input: vi.fn(),
         query: vi.fn().mockResolvedValue({ recordsets: [[{ id: 1 }]], recordset: [{ id: 1 }], rowsAffected: [1], output: {} }),
      };

      const result = await handler.execute({ db: mockRequest as never });
      expect(result.recordsets[0]).toMatchInlineSnapshot(`
        [
          {
            "id": 1,
          },
        ]
      `);
   });

   test("uses ConnectionPool.request() when available", async () => {
      const handler = new MssqlQueryHandler(simpleQuery.source);
      const mockRequest = {
         input: vi.fn(),
         query: vi.fn().mockResolvedValue({ recordsets: [[{ id: 1 }]], recordset: [{ id: 1 }], rowsAffected: [1], output: {} }),
      };
      const mockPool = { request: () => mockRequest };

      const result = await handler.execute({ db: mockPool as never });
      expect(result.recordsets[0]).toHaveLength(1);
   });

   test("wraps execution errors as SqlRunError", async () => {
      const handler = new MssqlQueryHandler(simpleQuery.source);
      const mockRequest = {
         input: vi.fn(),
         query: vi.fn().mockRejectedValue(new Error("connection failed")),
      };
      const mockPool = { request: () => mockRequest };

      try {
         await handler.execute({ db: mockPool as never });
         expect.fail("should have thrown");
      } catch (err) {
         expect(err).toBeInstanceOf(SqlRunError);
         expect((err as SqlRunError).retryable).toBe(false);
      }
   });

   test("marks retryable for deadlock error (number 1205)", async () => {
      const handler = new MssqlQueryHandler(simpleQuery.source);
      const mockRequest = {
         input: vi.fn(),
         query: vi.fn().mockRejectedValue({ number: 1205, message: "deadlock" }),
      };
      const mockPool = { request: () => mockRequest };

      try {
         await handler.execute({ db: mockPool as never });
         expect.fail("should have thrown");
      } catch (err) {
         expect(err).toBeInstanceOf(SqlRunError);
         expect((err as SqlRunError).retryable).toBe(true);
      }
   });

   test("marks retryable for ECONNRESET error", async () => {
      const handler = new MssqlQueryHandler(simpleQuery.source);
      const mockRequest = {
         input: vi.fn(),
         query: vi.fn().mockRejectedValue({ code: "ECONNRESET" }),
      };
      const mockPool = { request: () => mockRequest };

      try {
         await handler.execute({ db: mockPool as never });
         expect.fail("should have thrown");
      } catch (err) {
         expect(err).toBeInstanceOf(SqlRunError);
         expect((err as SqlRunError).retryable).toBe(true);
      }
   });

   test("marks retryable for ETIMEOUT error", async () => {
      const handler = new MssqlQueryHandler(simpleQuery.source);
      const mockRequest = {
         input: vi.fn(),
         query: vi.fn().mockRejectedValue({ code: "ETIMEOUT" }),
      };
      const mockPool = { request: () => mockRequest };

      try {
         await handler.execute({ db: mockPool as never });
         expect.fail("should have thrown");
      } catch (err) {
         expect(err).toBeInstanceOf(SqlRunError);
         expect((err as SqlRunError).retryable).toBe(true);
      }
   });

   test("wraps build errors in SqlRunError", () => {
      const handler = new MssqlQueryHandler(simpleQuery.source);
      const original = handler.source.getSql;
      handler.source.getSql = () => { throw new Error("build failed"); };

      try {
         expect(() => handler.getOptions({ db: {} as never })).toThrow(SqlRunError);
      } finally {
         handler.source.getSql = original;
      }
   });

   test("isRetryableMssqlError returns false for null/string errors", async () => {
      const handler = new MssqlQueryHandler(simpleQuery.source);
      const mockRequest = {
         input: vi.fn(),
         query: vi.fn().mockRejectedValue(null),
      };
      const mockPool = { request: () => mockRequest };

      try {
         await handler.execute({ db: mockPool as never });
         expect.fail("should have thrown");
      } catch (err) {
         expect(err).toBeInstanceOf(SqlRunError);
         expect((err as SqlRunError).retryable).toBe(false);
      }
   });

   test("handles Uint8Array values as VarBinary input", async () => {
      const handler = new MssqlQueryHandler(simpleQuery.source);
      const mockRequest = {
         input: vi.fn(),
         query: vi.fn().mockResolvedValue({ recordsets: [[]], recordset: [], rowsAffected: [0], output: {} }),
      };
      const mockPool = { request: () => mockRequest };

      const original = handler.source.getSql;
      handler.source.getSql = () => ({ text: "SELECT 1", values: [new Uint8Array([1, 2, 3]), "normal"] }) as never;

      try {
         await handler.execute({ db: mockPool as never });
         expect(mockRequest.input).toHaveBeenCalledTimes(2);
         expect(mockRequest.input.mock.calls[0]![2]).toBeInstanceOf(Buffer);
      } finally {
         handler.source.getSql = original;
      }
   });

});

import { describe, expect, test, vi } from "vitest";
import { PostgresQueryHandler } from "#/postgres-query-handler.js";
import { sql } from "#/postgres-sql.js";
import { SqlRunError } from "@vexnor/core";

const simpleQuery = sql`SELECT 1 as id`;

describe("PostgresQueryHandler.resolveRows()", () => {
   test("returns result.rows", () => {
      const handler = new PostgresQueryHandler(simpleQuery.source);
      const result = { rows: [{ id: 1 }], rowCount: 1, command: "SELECT", oid: 0, fields: [] };
      expect(handler.resolveRows(result as never)).toMatchInlineSnapshot(`
        [
          {
            "id": 1,
          },
        ]
      `);
   });
});

describe("PostgresQueryHandler.getOptions()", () => {
   test("returns query text and values", () => {
      const handler = new PostgresQueryHandler(simpleQuery.source);
      const result = handler.getOptions({ db: {} as never });
      expect(result.text).toContain("SELECT");
      expect(result.values).toMatchInlineSnapshot(`[]`);
   });
});

describe("PostgresQueryHandler.execute()", () => {
   test("executes query successfully", async () => {
      const handler = new PostgresQueryHandler(simpleQuery.source);
      const mockDb = {
         query: vi.fn().mockResolvedValue({ rows: [{ id: 1 }], rowCount: 1, command: "SELECT", oid: 0, fields: [] }),
      };

      const result = await handler.execute({ db: mockDb as never });
      expect(result.rows).toMatchInlineSnapshot(`
        [
          {
            "id": 1,
          },
        ]
      `);
      expect(mockDb.query).toHaveBeenCalledWith(
         expect.objectContaining({ text: expect.any(String), values: expect.any(Array) }),
      );
   });

   test("wraps execution errors as SqlRunError with QUERY_EXECUTION_FAILED", async () => {
      const handler = new PostgresQueryHandler(simpleQuery.source);
      const mockDb = {
         query: vi.fn().mockRejectedValue(new Error("connection refused")),
      };

      try {
         await handler.execute({ db: mockDb as never });
         expect.fail("should have thrown");
      } catch (err) {
         expect(err).toBeInstanceOf(SqlRunError);
         expect((err as SqlRunError).retryable).toBe(false);
      }
   });

   test("marks retryable for deadlock error (40P01)", async () => {
      const handler = new PostgresQueryHandler(simpleQuery.source);
      const mockDb = {
         query: vi.fn().mockRejectedValue({ code: "40P01", message: "deadlock detected" }),
      };

      try {
         await handler.execute({ db: mockDb as never });
         expect.fail("should have thrown");
      } catch (err) {
         expect(err).toBeInstanceOf(SqlRunError);
         expect((err as SqlRunError).retryable).toBe(true);
      }
   });

   test("marks retryable for connection reset (08006)", async () => {
      const handler = new PostgresQueryHandler(simpleQuery.source);
      const mockDb = {
         query: vi.fn().mockRejectedValue({ code: "08006" }),
      };

      try {
         await handler.execute({ db: mockDb as never });
         expect.fail("should have thrown");
      } catch (err) {
         expect(err).toBeInstanceOf(SqlRunError);
         expect((err as SqlRunError).retryable).toBe(true);
      }
   });

   test("wraps build errors in SqlRunError with QUERY_BUILD_FAILED", () => {
      const handler = new PostgresQueryHandler(simpleQuery.source);
      const original = handler.source.getSql;
      handler.source.getSql = () => {
         throw new Error("build failed");
      };

      try {
         expect(() => handler.getOptions({ db: {} as never, params: {} as never })).toThrow(SqlRunError);
      } finally {
         handler.source.getSql = original;
      }
   });

   test("calls debug callback when provided", async () => {
      const handler = new PostgresQueryHandler(simpleQuery.source);
      const mockDb = {
         query: vi.fn().mockResolvedValue({ rows: [], rowCount: 0, command: "SELECT", oid: 0, fields: [] }),
      };
      const debug = vi.fn();

      await handler.execute({ db: mockDb as never, options: { debug } });
      expect(debug).toHaveBeenCalledWith(expect.objectContaining({ text: expect.any(String) }));
   });
});

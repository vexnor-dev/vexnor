import { describe, expect, test, vi } from "vitest";
import { BetterSqlite3QueryHandler } from "#/better-sqlite3-query-handler.js";
import { Sqlite3Formatter } from "#/sqlite3-formatter.js";
import { sql } from "#/sqlite3-sql.js";
import { SqlRunError, SqlBuildContext } from "@vexnor/core";

const simpleQuery = sql`SELECT 1 as id`;

describe("BetterSqlite3QueryHandler.isReadResult()", () => {
   test("returns true for object with rows array", () => {
      const handler = new BetterSqlite3QueryHandler(simpleQuery.source);
      expect(handler.isReadResult({ rows: [] })).toBe(true);
   });

   test("returns false for null", () => {
      const handler = new BetterSqlite3QueryHandler(simpleQuery.source);
      expect(handler.isReadResult(null)).toBe(false);
   });

   test("returns false for RunResult (no rows)", () => {
      const handler = new BetterSqlite3QueryHandler(simpleQuery.source);
      expect(handler.isReadResult({ changes: 1, lastInsertRowid: 1 })).toBe(false);
   });
});

describe("BetterSqlite3QueryHandler.deserialize()", () => {
   test("returns result unchanged when not a read result", () => {
      const handler = new BetterSqlite3QueryHandler(simpleQuery.source);
      const runResult = { changes: 1, lastInsertRowid: 1 } as never;
      expect(handler.deserialize(runResult)).toBe(runResult);
   });

   test("deserializes rows when result is a read result", () => {
      const handler = new BetterSqlite3QueryHandler(simpleQuery.source);
      const readResult = { rows: [{ id: 1 }] };
      const result = handler.deserialize(readResult as never);
      expect(result.rows).toMatchInlineSnapshot(`
        [
          {
            "id": 1,
          },
        ]
      `);
   });
});

describe("BetterSqlite3QueryHandler.getOptions()", () => {
   test("returns sql and values", () => {
      const handler = new BetterSqlite3QueryHandler(simpleQuery.source);
      const result = handler.getOptions({ db: {} as never });
      expect(result.sql).toContain("SELECT");
      expect(result.values).toMatchInlineSnapshot(`[]`);
   });

   test("wraps build errors in SqlRunError", () => {
      const handler = new BetterSqlite3QueryHandler(simpleQuery.source);
      const original = handler.source.getSql;
      handler.source.getSql = () => { throw new Error("build failed"); };

      try {
         expect(() => handler.getOptions({ db: {} as never })).toThrow(SqlRunError);
      } finally {
         handler.source.getSql = original;
      }
   });
});

describe("BetterSqlite3QueryHandler.execute()", () => {
   test("executes read query and returns rows", async () => {
      const handler = new BetterSqlite3QueryHandler(simpleQuery.source);
      const mockStatement = { all: vi.fn().mockReturnValue([{ id: 1 }]), run: vi.fn() };
      const mockDb = { prepare: vi.fn().mockReturnValue(mockStatement) };

      const result = await handler.execute({ db: mockDb as never }, "read");
      expect(result).toMatchInlineSnapshot(`
        {
          "rows": [
            {
              "id": 1,
            },
          ],
        }
      `);
   });

   test("executes write query and returns RunResult", async () => {
      const handler = new BetterSqlite3QueryHandler(simpleQuery.source);
      const mockStatement = { all: vi.fn(), run: vi.fn().mockReturnValue({ changes: 1, lastInsertRowid: 1 }) };
      const mockDb = { prepare: vi.fn().mockReturnValue(mockStatement) };

      const result = await handler.execute({ db: mockDb as never }, "write");
      expect(result).toMatchInlineSnapshot(`
        {
          "changes": 1,
          "lastInsertRowid": 1,
        }
      `);
   });

   test("wraps execution errors as SqlRunError", async () => {
      const handler = new BetterSqlite3QueryHandler(simpleQuery.source);
      const mockDb = { prepare: vi.fn().mockImplementation(() => { throw new Error("db locked"); }) };

      try {
         await handler.execute({ db: mockDb as never }, "read");
         expect.fail("should have thrown");
      } catch (err) {
         expect(err).toBeInstanceOf(SqlRunError);
         expect((err as SqlRunError).retryable).toBe(false);
      }
   });

   test("marks retryable for SQLITE_BUSY", async () => {
      const handler = new BetterSqlite3QueryHandler(simpleQuery.source);
      const mockDb = { prepare: vi.fn().mockImplementation(() => { throw Object.assign(new Error("busy"), { code: "SQLITE_BUSY" }); }) };

      try {
         await handler.execute({ db: mockDb as never }, "read");
         expect.fail("should have thrown");
      } catch (err) {
         expect(err).toBeInstanceOf(SqlRunError);
         expect((err as SqlRunError).retryable).toBe(true);
      }
   });

   test("marks retryable for SQLITE_LOCKED", async () => {
      const handler = new BetterSqlite3QueryHandler(simpleQuery.source);
      const mockDb = { prepare: vi.fn().mockImplementation(() => { throw Object.assign(new Error("locked"), { code: "SQLITE_LOCKED" }); }) };

      try {
         await handler.execute({ db: mockDb as never }, "read");
         expect.fail("should have thrown");
      } catch (err) {
         expect(err).toBeInstanceOf(SqlRunError);
         expect((err as SqlRunError).retryable).toBe(true);
      }
   });

   test("calls debug callback when provided", async () => {
      const handler = new BetterSqlite3QueryHandler(simpleQuery.source);
      const mockStatement = { all: vi.fn().mockReturnValue([]), run: vi.fn() };
      const mockDb = { prepare: vi.fn().mockReturnValue(mockStatement) };
      const debug = vi.fn();

      await handler.execute({ db: mockDb as never, options: { debug } }, "read");
      expect(debug).toHaveBeenCalledWith(expect.objectContaining({ sql: expect.any(String) }));
   });
});

describe("Sqlite3Formatter", () => {
   const formatter = new Sqlite3Formatter();

   test("getColumnFormat returns columnName for insert into", () => {
      const ctx = new SqlBuildContext({});
      ctx.next("insert into");
      expect(formatter.getColumnFormat(ctx)).toBe("columnName");
   });

   test("getColumnFormat returns tableName.columnName for set", () => {
      const ctx = new SqlBuildContext({});
      ctx.next("set");
      expect(formatter.getColumnFormat(ctx)).toBe("tableName.columnName");
   });

   test("getColumnFormat returns tableName.columnName AS columnAlias for returning", () => {
      const ctx = new SqlBuildContext({});
      ctx.next("returning");
      expect(formatter.getColumnFormat(ctx)).toBe("tableName.columnName AS columnAlias");
   });

   test("getTableFormat returns schema.tableName for insert into", () => {
      const ctx = new SqlBuildContext({});
      ctx.next("insert into");
      expect(formatter.getTableFormat(ctx)).toBe("schema.tableName");
   });

   test("getTableFormat returns schema.tableName for update", () => {
      const ctx = new SqlBuildContext({});
      ctx.next("update");
      expect(formatter.getTableFormat(ctx)).toBe("schema.tableName");
   });

   test("getTableFormat falls through to super for select", () => {
      const ctx = new SqlBuildContext({});
      ctx.next("select");
      const format = formatter.getTableFormat(ctx);
      expect(format).toBeDefined();
   });
});

import { describe, expect, test } from "vitest";
import { sql } from "#src/core/sql.js";
import { row } from "#src/core/query/sql-select-row.js";
import { Account } from "@test-models/vexnor_dev.account-table.js";
import { mockHandler } from "#src/test/mock-query-handler.js";
import { newSqlQueryHandler } from "#src/core/query/sql-query-handler.js";
import { MockQueryHandler } from "#src/test/mock-query-handler.js";

const findAccounts = sql`
   select ${row(Account.$accountId, Account.$email, Account.$createdAt)}
   from ${Account}
`;

describe("SqlQueryHandler.getRowSchema()", () => {
   test("returns full schema for remote client", () => {
      const handler = mockHandler(findAccounts);
      const schema = handler.getRowSchema(true);
      expect(schema).toMatchInlineSnapshot(`
        {
          "createdAt": "Date",
        }
      `);
   });

   test("returns filtered schema for local client (excludes string Date types)", () => {
      const handler = mockHandler(findAccounts);
      const schema = handler.getRowSchema(false);
      expect(schema).toMatchInlineSnapshot(`{}`);
   });

   test("caches schema by isRemoteClient flag", () => {
      const handler = mockHandler(findAccounts);
      const first = handler.getRowSchema(true);
      const second = handler.getRowSchema(true);
      expect(first).toBe(second);
   });
});

describe("SqlQueryHandler.deserializeRows()", () => {
   test("returns rows unchanged when schema is empty", () => {
      const noDateQuery = sql`select ${row(Account.$accountId)} from ${Account}`;
      const handler = mockHandler(noDateQuery);
      const rows = [{ accountId: "1" }];
      expect(handler.deserializeRows(rows, false)).toBe(rows);
   });

   test("returns rows unchanged when filtered schema is empty (local, only string types)", () => {
      const handler = mockHandler(findAccounts);
      const rows = [{ accountId: "1", email: "a@b.com", createdAt: new Date() }];
      const result = handler.deserializeRows(rows, false);
      expect(result).toBe(rows);
   });

   test("deserializes Date strings for remote client", () => {
      const handler = mockHandler(findAccounts);
      const isoDate = "2024-01-01T00:00:00.000Z";
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const rows = [{ accountId: "1", email: "a@b.com", createdAt: isoDate as any }];
      const result = handler.deserializeRows(rows, true);
      expect(result[0]!.createdAt).toBeInstanceOf(Date);
   });
});

describe("SqlQueryHandler.isReadResult()", () => {
   test("returns true for object with rows array", () => {
      const handler = mockHandler(findAccounts);
      expect(handler.isReadResult({ rows: [] })).toBe(true);
   });

   test("returns false for null", () => {
      const handler = mockHandler(findAccounts);
      expect(handler.isReadResult(null)).toBe(false);
   });

   test("returns false for non-object", () => {
      const handler = mockHandler(findAccounts);
      expect(handler.isReadResult("string")).toBe(false);
   });

   test("returns false for object without rows", () => {
      const handler = mockHandler(findAccounts);
      expect(handler.isReadResult({ data: [] })).toBe(false);
   });

   test("returns false when rows is not an array", () => {
      const handler = mockHandler(findAccounts);
      expect(handler.isReadResult({ rows: "not array" })).toBe(false);
   });
});

describe("newSqlQueryHandler proxy", () => {
   test("proxy ownKeys includes source row keys", () => {
      const handler = newSqlQueryHandler(new MockQueryHandler(findAccounts));
      const keys = Object.keys(handler);
      expect(keys).toContain("$accountId");
      expect(keys).toContain("$email");
   });

   test("proxy has returns true for row keys", () => {
      const handler = newSqlQueryHandler(new MockQueryHandler(findAccounts));
      expect("$accountId" in handler).toBe(true);
   });

   test("proxy get returns source row column", () => {
      const handler = newSqlQueryHandler(new MockQueryHandler(findAccounts));
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      expect((handler as any).$accountId).toBeDefined();
   });

   test("proxy getOwnPropertyDescriptor for row key", () => {
      const handler = newSqlQueryHandler(new MockQueryHandler(findAccounts));
      const desc = Object.getOwnPropertyDescriptor(handler, "$accountId");
      expect(desc).toBeDefined();
   });

   test("proxy getOwnPropertyDescriptor for unknown key is undefined", () => {
      const handler = newSqlQueryHandler(new MockQueryHandler(findAccounts));
      const desc = Object.getOwnPropertyDescriptor(handler, "nonExistent");
      expect(desc).toBeUndefined();
   });

   test("proxy get returns undefined for unknown key", () => {
      const handler = newSqlQueryHandler(new MockQueryHandler(findAccounts));
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      expect((handler as any).nonExistent).toBeUndefined();
   });
});

describe("SqlQueryHandler.rowType", () => {
   test("throws when accessed", () => {
      const handler = mockHandler(findAccounts);
      expect(() => handler.rowType).toThrow("this property is only for fetching the row type");
   });
});

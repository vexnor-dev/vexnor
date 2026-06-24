import { describe, it, expect } from "vitest";
import { sql } from "#/core/sql.js";
import { Account } from "@test-models/vexnor_dev.account-table.js";
import { row } from "#/core/query/sql-select-row.js";
import { MockQueryHandler } from "#/test/mock-query-handler.js";
import type { MockConnection } from "#/test/mock-plugin.js";
import { getQueryMeta, setQueryMeta } from "#/core/query/query-meta-store.js";

function createMockDb(rows: unknown[] = []): MockConnection {
   return {
      query: () => Promise.resolve({ rows }),
   } as unknown as MockConnection;
}

describe("QueryMeta via getQueryMeta()", () => {
   const q = sql`SELECT ${row(Account.$accountId)} FROM ${Account}`;

   it("meta is available via getQueryMeta after .all()", async () => {
      const db = createMockDb([{ accountId: "1" }]);
      const handler = new MockQueryHandler(q);

      const rows = await handler.all({ db });

      expect(rows).toEqual([{ accountId: "1" }]);
      const meta = getQueryMeta(rows);
      expect(meta).toBeDefined();
      expect(meta!.sql).toBeDefined();
      expect(meta!.sql).toContain("account");
      expect(meta!.params).toEqual([]);
      expect(meta!.duration).toBeTypeOf("number");
      expect(meta!.duration).toBeGreaterThanOrEqual(0);
   });

   it("meta is available via getQueryMeta after options.meta usage", async () => {
      const db = createMockDb([{ accountId: "1" }]);
      const handler = new MockQueryHandler(q);

      const rows = await handler.all({ db });
      const meta = getQueryMeta(rows);

      expect(meta).toBeDefined();
      expect(meta).toHaveProperty("sql");
      expect(meta).toHaveProperty("params", []);
      expect(meta).toHaveProperty("duration");
   });

   it("returns undefined for non-query objects", () => {
      expect(getQueryMeta({})).toBeUndefined();
      expect(getQueryMeta(null)).toBeUndefined();
      expect(getQueryMeta(undefined)).toBeUndefined();
      expect(getQueryMeta([1, 2, 3])).toBeUndefined();
      expect(getQueryMeta("string")).toBeUndefined();
   });

   it("result has no __query__ or __params__ properties", async () => {
      const db = createMockDb([{ accountId: "1" }]);
      const handler = new MockQueryHandler(q);

      const rows = await handler.all({ db });

      expect("__query__" in rows).toBe(false);
      expect("__params__" in rows).toBe(false);
   });

   it("measures duration", async () => {
      const db = {
         query: () => new Promise((r) => setTimeout(r, 10)).then(() => ({ rows: [{ accountId: "1" }] })),
      } as unknown as MockConnection;
      const handler = new MockQueryHandler(q);

      const rows = await handler.all({ db });
      const meta = getQueryMeta(rows);

      expect(meta).toBeDefined();
      expect(meta!.duration).toBeGreaterThanOrEqual(9);
   });

   it("meta survives destructuring into a new object (serialize scenario)", () => {
      const original = { rows: [{ id: 1 }], rowCount: 1, command: "SELECT", oid: 0 };
      setQueryMeta(original, { sql: "SELECT 1", params: [], duration: 5 });

      // Simulate what plugin serialize() does: destructure into new object
      const { rows, rowCount, command, oid } = original;
      const serialized = { rows, rowCount, command, oid };

      // Forward meta (what fixed serialize does)
      const meta = getQueryMeta(original);
      if (meta) setQueryMeta(serialized, meta);

      const result = getQueryMeta(serialized);
      expect(result).toBeDefined();
      expect(result!.sql).toBe("SELECT 1");
      expect(result!.duration).toBe(5);
   });

   it("meta is accessible via Symbol fallback when WeakMap is unavailable", () => {
      const obj = { rows: [] };
      setQueryMeta(obj, { sql: "SELECT 2", params: [1], duration: 10 });

      // Simulate a different WeakMap (bundler duplication) by reading the symbol directly
      const meta = Object.getOwnPropertyDescriptor(obj, Symbol.for("vexnor.queryMeta"))?.value as { sql: string; params: unknown[]; duration: number };
      expect(meta).toBeDefined();
      expect(meta.sql).toBe("SELECT 2");
      expect(meta.params).toEqual([1]);
      expect(meta.duration).toBe(10);
   });
});

import { describe, it, expect } from "vitest";
import { sql } from "#/core/sql.js";
import { Account } from "@test-models/vexnor_dev.account-table.js";
import { row } from "#/core/query/sql-select-row.js";
import { MockQueryHandler } from "#/test/mock-query-handler.js";
import type { MockConnection } from "#/test/mock-plugin.js";
import { getQueryMeta } from "#/core/query/query-meta-store.js";

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

   it("options.meta is still populated when provided", async () => {
      const db = createMockDb([{ accountId: "1" }]);
      const handler = new MockQueryHandler(q);
      const meta = {};

      await handler.all({ db, options: { meta } });

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
});

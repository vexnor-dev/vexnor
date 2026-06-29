import { describe, it, expect } from "vitest";
import { sql } from "#src/core/sql.js";
import { Account } from "@test-models/vexnor_dev.account-table.js";
import { row } from "#src/core/query/sql-select-row.js";
import { MockQueryHandler } from "#src/test/mock-query-handler.js";
import type { MockConnection } from "#src/test/mock-plugin.js";
import { getQueryMeta, setQueryMeta } from "#src/core/query/query-meta-store.js";

function createMockDb(rows: unknown[] = []): MockConnection {
   return {
      query: () => Promise.resolve({ rows }),
   } as unknown as MockConnection;
}

describe("SqlQueryHandler.one() — meta propagation", () => {
   const q = sql`SELECT ${row(Account.$accountId)} FROM ${Account}`;

   it("returns meta from underlying rows", async () => {
      const db = createMockDb([{ accountId: "1" }]);
      const handler = new MockQueryHandler(q);
      const result = await handler.one({ db });
      const meta = getQueryMeta(result as object);
      expect(meta).toBeDefined();
      expect(meta!.sql).toMatchInlineSnapshot(`
        "/* <query_0> */
        SELECT
          "a_1"."account_id" AS "accountId"
        FROM
          "main"."account" AS "a_1" /* </query_0> */"
      `);
      expect(meta!.params).toMatchInlineSnapshot(`[]`);
      expect(meta!.duration).toBeTypeOf("number");
   });

   it("throws on 0 rows", async () => {
      const db = createMockDb([]);
      const handler = new MockQueryHandler(q);
      await expect(handler.one({ db })).rejects.toThrow("Expected one row, actual is 0 rows.");
   });

   it("throws on >1 rows", async () => {
      const db = createMockDb([{ accountId: "1" }, { accountId: "2" }]);
      const handler = new MockQueryHandler(q);
      await expect(handler.one({ db })).rejects.toThrow("Expected one row, actual is 2 rows.");
   });
});

describe("SqlQueryHandler.first() — meta propagation", () => {
   const q = sql`SELECT ${row(Account.$accountId)} FROM ${Account}`;

   it("returns meta from first row", async () => {
      const db = createMockDb([{ accountId: "1" }, { accountId: "2" }]);
      const handler = new MockQueryHandler(q);
      const result = await handler.first({ db });
      expect(result).toMatchInlineSnapshot(`
        {
          "accountId": "1",
        }
      `);
      const meta = getQueryMeta(result as object);
      expect(meta).toBeDefined();
      expect(meta!.duration).toBeTypeOf("number");
   });

   it("returns undefined for empty result", async () => {
      const db = createMockDb([]);
      const handler = new MockQueryHandler(q);
      const result = await handler.first({ db });
      expect(result).toMatchInlineSnapshot(`undefined`);
   });
});

describe("SqlQueryHandler.any() — meta propagation", () => {
   const q = sql`SELECT ${row(Account.$accountId)} FROM ${Account}`;

   it("returns meta from first row", async () => {
      const db = createMockDb([{ accountId: "x" }]);
      const handler = new MockQueryHandler(q);
      const result = await handler.any({ db });
      expect(result).toMatchInlineSnapshot(`
        {
          "accountId": "x",
        }
      `);
      const meta = getQueryMeta(result as object);
      expect(meta).toBeDefined();
      expect(meta!.sql).toBeDefined();
   });

   it("returns undefined for empty result", async () => {
      const db = createMockDb([]);
      const handler = new MockQueryHandler(q);
      const result = await handler.any({ db });
      expect(result).toMatchInlineSnapshot(`undefined`);
   });
});

describe("SqlQueryHandler.runLocal() — meta creation", () => {
   const q = sql`SELECT ${row(Account.$accountId)} FROM ${Account}`;

   it("creates meta, passes to execute, captures duration", async () => {
      const db = createMockDb([{ accountId: "1" }]);
      const handler = new MockQueryHandler(q);
      const result = await handler.runLocal({ db });
      const meta = getQueryMeta(result);
      expect(meta).toBeDefined();
      expect(meta!.sql).toBeDefined();
      expect(meta!.params).toMatchInlineSnapshot(`[]`);
      expect(meta!.duration).toBeTypeOf("number");
      expect(meta!.duration).toBeGreaterThanOrEqual(0);
   });
});

describe("SqlQueryHandler.run() — local path", () => {
   const q = sql`SELECT ${row(Account.$accountId)} FROM ${Account}`;

   it("delegates to runLocal and calls serialize() on result", async () => {
      const db = createMockDb([{ accountId: "1" }]);
      const handler = new MockQueryHandler(q);
      const result = await handler.run({ db });
      const meta = getQueryMeta(result);
      expect(meta).toBeDefined();
      expect(meta!.sql).toBeDefined();
   });
});

describe("SqlQueryHandler.serialize() — base class", () => {
   const q = sql`SELECT ${row(Account.$accountId)} FROM ${Account}`;

   it("is the identity function", () => {
      const handler = new MockQueryHandler(q);
      const input = { rows: [{ accountId: "1" }] };
      setQueryMeta(input, { sql: "SELECT 1", params: [], duration: 1 });
      const output = handler.serialize(input);
      expect(output).toMatchInlineSnapshot(`
        {
          "rows": [
            {
              "accountId": "1",
            },
          ],
        }
      `);
      expect(output).toBe(input);
   });
});

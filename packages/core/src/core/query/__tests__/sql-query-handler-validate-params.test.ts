import { describe, expect, test, beforeEach } from "vitest";
import { sqlSelect } from "#src/core/crud/sql-select.js";
import { Account, Order } from "@test-models/vexnor_dev.schema.js";
import { SqlTable } from "#src/core/schema/sql-table.js";
import { mockHandler } from "#src/test/mock-query-handler.js";
import { MockConnection } from "#src/test/mock-plugin.js";
import { newSqlQueryHandler } from "#src/core/query/sql-query-handler.js";

function makeDb(rows: unknown[] = []): MockConnection {
   return { query: async () => ({ rows }) } as MockConnection;
}

describe("SqlQueryHandler — validateParams with select aliases", () => {
   beforeEach(() => {
      SqlTable.clearRegistry();
      SqlTable.register(Account);
      SqlTable.register(Order);
   });

   test("orderBy accepts select alias as valid field when select param is present", async () => {
      const query = sqlSelect(Account, {});
      const handler = mockHandler(query);

      // select has alias "totalCount", orderBy should accept it via runtime validation
      const result = await handler.all({
         db: Promise.resolve(makeDb([{ accountId: "1" }])),
         params: {
            select: { totalCount: { fn: "count", col: "*" }, status: true } satisfies Record<string, unknown>,
            orderBy: { totalCount: "desc" } satisfies Record<string, string>,
         } as Parameters<typeof handler.all>[0]["params"],
      });
      expect(result).toMatchInlineSnapshot(`
        [
          {
            "accountId": "1",
          },
        ]
      `);
   });

   test("orderBy validation fails for invalid field not in select aliases", async () => {
      const query = sqlSelect(Account, {});
      const handler = mockHandler(query);

      await expect(
         handler.all({
            db: Promise.resolve(makeDb([])),
            params: {
               select: { total: { fn: "count", col: "*" } } satisfies Record<string, unknown>,
               orderBy: { nonExistentAlias: "desc" } satisfies Record<string, string>,
            } as Parameters<typeof handler.all>[0]["params"],
         }),
      ).rejects.toThrow("Invalid param");
   });

   test("validateParams works with plain column selection (no aggregates, no aliases)", async () => {
      const query = sqlSelect(Account, {});
      const handler = mockHandler(query);

      // select is object with true values — no aggregates, so no aliases for orderBy
      const result = await handler.all({
         db: Promise.resolve(makeDb([{ accountId: "1" }])),
         params: {
            select: { accountId: true, email: true },
            orderBy: { email: "asc" },
         },
      });
      expect(result).toMatchInlineSnapshot(`
        [
          {
            "accountId": "1",
          },
        ]
      `);
   });
});

describe("SqlQueryHandler — orderBy validation when fieldNames is null", () => {
   beforeEach(() => {
      SqlTable.clearRegistry();
      SqlTable.register(Account);
      SqlTable.register(Order);
   });

   test("orderBy with select aliases extends validation when fieldNames is absent on param", async () => {
      const query = sqlSelect(Account, {});
      const handler = mockHandler(query);

      // Patch the orderBy param's validation.obj to have no fieldNames,
      // simulating a param where only fieldValues is specified.
      // Use delete to ensure the property is truly absent (not just null).
      const params = handler.source.params as Record<string, { name: string; validation: { obj: Record<string, unknown> } }>;
      const orderByParam = Object.values(params).find((p) => p.name === "orderBy");
      if (orderByParam?.validation?.obj) {
         delete orderByParam.validation.obj.fieldNames;
      }

      // The handler should still accept the select alias as a valid orderBy key
      // because the code initializes fieldNames = [] when absent and pushes selectAliases
      const result = await handler.all({
         db: Promise.resolve(makeDb([{ accountId: "1" }])),
         params: {
            select: { totalCount: { fn: "count", col: "*" } } satisfies Record<string, unknown>,
            orderBy: { totalCount: "desc" } satisfies Record<string, string>,
         } as Parameters<typeof handler.all>[0]["params"],
      });
      expect(result).toMatchInlineSnapshot(`
        [
          {
            "accountId": "1",
          },
        ]
      `);
   });

   test("orderBy with select aliases rejects invalid field when fieldNames is absent", async () => {
      const query = sqlSelect(Account, {});
      const handler = mockHandler(query);

      // Patch the orderBy param's validation.obj to have no fieldNames
      const params = handler.source.params as Record<string, { name: string; validation: { obj: Record<string, unknown> } }>;
      const orderByParam = Object.values(params).find((p) => p.name === "orderBy");
      if (orderByParam?.validation?.obj) {
         delete orderByParam.validation.obj.fieldNames;
      }

      await expect(
         handler.all({
            db: Promise.resolve(makeDb([])),
            params: {
               select: { total: { fn: "count", col: "*" } } satisfies Record<string, unknown>,
               orderBy: { badField: "desc" } satisfies Record<string, string>,
            } as Parameters<typeof handler.all>[0]["params"],
         }),
      ).rejects.toThrow("Invalid param");
   });

   test("orderBy validation is skipped when orderBy value is undefined", async () => {
      const query = sqlSelect(Account, {});
      const handler = mockHandler(query);

      // Provide select aliases but no orderBy param — should not throw
      const result = await handler.all({
         db: Promise.resolve(makeDb([{ accountId: "1" }])),
         params: {
            select: { totalCount: { fn: "count", col: "*" } } satisfies Record<string, unknown>,
            // orderBy deliberately omitted — triggers `if (value === undefined) continue`
         } as Parameters<typeof handler.all>[0]["params"],
      });
      expect(result).toMatchInlineSnapshot(`
        [
          {
            "accountId": "1",
          },
        ]
      `);
   });
});

describe("SqlQueryHandler — proxy getOwnPropertyDescriptor/has/get coverage", () => {
   beforeEach(() => {
      SqlTable.clearRegistry();
      SqlTable.register(Account);
   });

   test("proxy has() returns true for source property on handler", () => {
      const query = sqlSelect(Account, {});
      const handler = mockHandler(query);
      const proxied = newSqlQueryHandler(handler);
      expect("source" in proxied).toBe(true);
   });

   test("proxy has() returns true for row column properties", () => {
      const query = sqlSelect(Account, {});
      const handler = mockHandler(query);
      const proxied = newSqlQueryHandler(handler);
      expect("$accountId" in proxied).toBe(true);
   });

   test("proxy get() returns row column from source.row", () => {
      const query = sqlSelect(Account, {});
      const handler = mockHandler(query);
      const proxied = newSqlQueryHandler(handler);
      const col = (proxied as unknown as Record<string, unknown>)["$accountId"];
      expect(col).toBeDefined();
   });

   test("proxy getOwnPropertyDescriptor() for row column", () => {
      const query = sqlSelect(Account, {});
      const handler = mockHandler(query);
      const proxied = newSqlQueryHandler(handler);
      const desc = Object.getOwnPropertyDescriptor(proxied, "$accountId");
      expect(desc).toBeDefined();
   });

   test("proxy ownKeys() includes row keys", () => {
      const query = sqlSelect(Account, {});
      const handler = mockHandler(query);
      const proxied = newSqlQueryHandler(handler);
      const keys = Object.keys(proxied);
      expect(keys).toContain("$accountId");
   });

   test("proxy get() returns undefined for non-existent property with no source", () => {
      const query = sqlSelect(Account, {});
      const handler = mockHandler(query);
      const proxied = newSqlQueryHandler(handler);
      const val = (proxied as unknown as Record<string, unknown>)["$nonExistent"];
      expect(val).toBeUndefined();
   });
});

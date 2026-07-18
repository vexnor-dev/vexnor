import { describe, expect, test } from "vitest";
import { sql } from "#src/core/sql.js";
import { row } from "#src/core/query/sql-select-row.js";
import { newSqlTable } from "#src/core/schema/sql-table.js";
import { SqlErrorCode } from "#src/core/sql-error-code.js";
import { SqlRunError } from "#src/core/sql-run-error.js";
import { MockConnection } from "#src/test/mock-plugin.js";
import { mockHandler } from "#src/test/mock-query-handler.js";

function makeDb(rows: unknown[] = []): MockConnection {
   return { query: async () => ({ rows }) } as MockConnection;
}

const BillingAccount = newSqlTable<{
   Select: { id: string; email: string };
   Source: "app:billing";
}>({
   tableInfo: { name: "account", schema: "billing" },
   pk: ["id"],
   source: "app:billing",
   columns: { id: "id", email: "email" },
   crud: { select: true, insert: false, update: false, delete: false },
});

const WarehouseOrder = newSqlTable<{
   Select: { id: string; accountId: string };
   Source: "app:warehouse";
}>({
   tableInfo: { name: "order", schema: "warehouse" },
   pk: ["id"],
   source: "app:warehouse",
   columns: { id: "id", accountId: "account_id" },
   crud: { select: true, insert: false, update: false, delete: false },
});

describe("SqlQueryHandler multi-source runtime guard", () => {
   test("throws MULTI_SOURCE_QUERY when query references multiple sources", async () => {
      const query = sql`SELECT ${row(BillingAccount.$$)} FROM ${BillingAccount} JOIN ${WarehouseOrder} ON ${WarehouseOrder.$accountId} = ${BillingAccount.$id}`;

      const db = makeDb();

      await expect(mockHandler(query).all({ db })).rejects.toThrow(SqlRunError);
      await expect(mockHandler(query).all({ db })).rejects.toMatchObject({
         code: SqlErrorCode.MULTI_SOURCE_QUERY,
      });
   });

   test("does not throw for single-source queries", async () => {
      const query = sql`SELECT ${row(BillingAccount.$$)} FROM ${BillingAccount}`;

      const db = makeDb([{ id: "1", email: "test@test.com" }]);

      const result = await mockHandler(query).all({ db });
      expect(result).toMatchInlineSnapshot(`
        [
          {
            "email": "test@test.com",
            "id": "1",
          },
        ]
      `);
   });

   test("does not throw for queries with no tables", async () => {
      const query = sql`SELECT 1 as "val"`;

      const db = makeDb([{ val: 1 }]);

      const result = await mockHandler(query).all({ db });
      expect(result).toMatchInlineSnapshot(`
        [
          {
            "val": 1,
          },
        ]
      `);
   });

   test("throws for multi-source subquery", async () => {
      const sub = sql`SELECT ${row(WarehouseOrder.$$)} FROM ${WarehouseOrder}`;
      const query = sql`SELECT * FROM ${BillingAccount} JOIN ${sub} ON 1=1`;

      const db = makeDb();

      await expect(mockHandler(query).all({ db })).rejects.toMatchObject({
         code: SqlErrorCode.MULTI_SOURCE_QUERY,
      });
   });
});

describe("SqlQuery multi-source compile-time guard", () => {
   test("multi-source query .mock resolves to MultiSourceError — no .all() method", () => {
      const query = sql`SELECT ${row(BillingAccount.$$)} FROM ${BillingAccount} JOIN ${WarehouseOrder} ON 1=1`;

      // @ts-expect-error — multi-source query: .mock is MultiSourceError, has no .all()
      void query.mock.all;
   });

   test("single-source query .mock resolves to MockQueryHandler — .all() exists", () => {
      const query = sql`SELECT ${row(BillingAccount.$$)} FROM ${BillingAccount}`;

      // This should compile without error — single source
      expect(query.mock.all).toBeDefined();
   });

   test("no-table query .mock resolves to MockQueryHandler — Sources is never, falls through", () => {
      const query = sql`SELECT 1 as "x"`;

      // This should compile without error — no sources means no restriction
      expect(query.mock.all).toBeDefined();
   });
});

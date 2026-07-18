import { describe, expect, test } from "vitest";
import { SqlTable, newSqlTable, type SqlTableForeignKey, type SqlTableAny } from "#src/core/schema/sql-table.js";
import { type SqlTableColumnAny } from "#src/core/schema/sql-table-column.js";

function makeTable(name: string, columns: Record<string, string>, fk?: SqlTableForeignKey[]) {
   return newSqlTable<{ Select: Record<string, unknown>; Insert: Record<string, unknown>; Update: Record<string, unknown>; Delete: true; Source: "test" }>({
      crud: { select: true, insert: true, update: true, delete: true },
      tableInfo: { name, schema: "public", alias: null, out: false },
      pk: ["id"],
      source: "test",
      fk,
      columns: columns as never,
   });
}

/** Helper to get a column from a table by key — bypasses strict typing for tests */
function col(table: SqlTableAny, key: string): SqlTableColumnAny {
   return table.column(`$${key}`);
}

describe("SqlTable.connect() — Lazy FK", () => {
   test("codegen FKs are available via .fk getter", () => {
      const fk: SqlTableForeignKey[] = [
         { from: ["customerId"], to: { schema: "public", table: "customer", columns: ["customerId"] } },
      ];
      const table = makeTable("payment", { id: "id", customerId: "customer_id" }, fk);
      expect(table.fk).toMatchInlineSnapshot(`
        [
          {
            "from": [
              "customerId",
            ],
            "to": {
              "columns": [
                "customerId",
              ],
              "schema": "public",
              "table": "customer",
            },
          },
        ]
      `);
   });

   test("SqlTable.connect() adds FK that merges with codegen FKs", () => {
      const Staff = makeTable("staff", { id: "id", staffId: "staff_id" });
      const Payment = makeTable("payment", { id: "id", customerId: "customer_id", staffId: "staff_id" }, [
         { from: ["customerId"], to: { schema: "public", table: "customer", columns: ["customerId"] } },
      ]);

      SqlTable.connect(
         { table: Payment, fields: [col(Payment, "staffId")] },
         { table: Staff, fields: [col(Staff, "staffId")] },
      );

      expect(Payment.fk).toMatchInlineSnapshot(`
        [
          {
            "from": [
              "customerId",
            ],
            "to": {
              "columns": [
                "customerId",
              ],
              "schema": "public",
              "table": "customer",
            },
          },
          {
            "from": [
              "staffId",
            ],
            "to": {
              "columns": [
                "staffId",
              ],
              "schema": "public",
              "table": "staff",
            },
          },
        ]
      `);
   });

   test("SqlTable.connect() can be called multiple times before evaluation", () => {
      const Customer = makeTable("customer", { id: "id", customerId: "customer_id" });
      const Product = makeTable("product", { id: "id", productId: "product_id" });
      const Order = makeTable("order", { id: "id", customerId: "customer_id", productId: "product_id" });

      SqlTable.connect(
         { table: Order, fields: [col(Order, "customerId")] },
         { table: Customer, fields: [col(Customer, "customerId")] },
      );
      SqlTable.connect(
         { table: Order, fields: [col(Order, "productId")] },
         { table: Product, fields: [col(Product, "productId")] },
      );

      expect(Order.fk).toHaveLength(2);
   });

   test("SqlTable.connect() throws if called after .fk has been evaluated", () => {
      const Staff = makeTable("staff", { id: "id", staffId: "staff_id" });
      const Payment = makeTable("payment", { id: "id", customerId: "customer_id", staffId: "staff_id" }, [
         { from: ["customerId"], to: { schema: "public", table: "customer", columns: ["customerId"] } },
      ]);

      // Force evaluation
      void Payment.fk;

      expect(() => {
         SqlTable.connect(
            { table: Payment, fields: [col(Payment, "staffId")] },
            { table: Staff, fields: [col(Staff, "staffId")] },
         );
      }).toThrow(/Cannot add relationships to "payment"/);
   });

   test("table without codegen FKs works with SqlTable.connect()", () => {
      const User = makeTable("user", { id: "id", userId: "user_id" });
      const Event = makeTable("event", { id: "id", userId: "user_id" });

      SqlTable.connect(
         { table: Event, fields: [col(Event, "userId")] },
         { table: User, fields: [col(User, "userId")] },
      );

      expect(Event.fk).toMatchInlineSnapshot(`
        [
          {
            "from": [
              "userId",
            ],
            "to": {
              "columns": [
                "userId",
              ],
              "schema": "public",
              "table": "user",
            },
          },
        ]
      `);
   });

   test("table without codegen FKs or connect() returns empty array", () => {
      const table = makeTable("standalone", { id: "id" });
      expect(table.fk).toMatchInlineSnapshot(`[]`);
   });
});

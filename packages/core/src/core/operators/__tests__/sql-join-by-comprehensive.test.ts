import { describe, expect, test, beforeEach } from "vitest";
import { Account, Order, OrderItem, Product } from "@test-models/vexnor_dev.schema.js";
import { SqlTable } from "#src/core/schema/sql-table.js";
import { sql } from "#src/core/sql.js";

describe("SqlJoinBy — join type variations via Table.join()", () => {
   beforeEach(() => {
      SqlTable.register(Account);
      SqlTable.register(Order);
      SqlTable.register(OrderItem);
      SqlTable.register(Product);
   });

   test("inner join (default)", () => {
      const query = Order.join({ account: Account }).select({});
      const result = query.getSql({
         params: { joinBy: { account: { on: [["_.accountId", "=", "account.accountId"]] } } },
         options: { dialect: "sqlite" },
      });
      expect(result.text).toContain("JOIN");
      expect(result.text).toContain("account");
      expect(result.text).not.toContain("LEFT");
   });

   test("left join", () => {
      const query = Order.join({ account: [Account, "left"] }).select({});
      const result = query.getSql({
         params: { joinBy: { account: { on: [["_.accountId", "=", "account.accountId"]] } } },
         options: { dialect: "sqlite" },
      });
      expect(result.text).toContain("LEFT JOIN");
   });

   test("right join", () => {
      const query = Order.join({ account: [Account, "right"] }).select({});
      const result = query.getSql({
         params: { joinBy: { account: { on: [["_.accountId", "=", "account.accountId"]] } } },
         options: { dialect: "sqlite" },
      });
      expect(result.text).toContain("RIGHT JOIN");
   });

   test("full join", () => {
      const query = Order.join({ account: [Account, "full"] }).select({});
      const result = query.getSql({
         params: { joinBy: { account: { on: [["_.accountId", "=", "account.accountId"]] } } },
         options: { dialect: "sqlite" },
      });
      expect(result.text).toContain("FULL JOIN");
   });

   test("cross join (no ON clause)", () => {
      const query = Order.join({ account: [Account, "cross"] }).select({});
      const result = query.getSql({
         params: { joinBy: { account: { on: [] } } },
         options: { dialect: "sqlite" },
      });
      expect(result.text).toContain("CROSS JOIN");
   });
});

describe("SqlTable.join() — typed alias-map API", () => {
   beforeEach(() => {
      SqlTable.register(Account);
      SqlTable.register(Order);
      SqlTable.register(OrderItem);
      SqlTable.register(Product);
   });

   test(".join() returns builder with joinMap", () => {
      const builder = Order.join({ account: Account });
      expect(builder.rootTable).toBe(Order);
      expect(builder.joinMap).toEqual({ account: Account });
   });

   test(".join() with multiple tables", () => {
      const builder = OrderItem.join({ order: Order, account: Account });
      expect(builder.joinMap.order).toBe(Order);
      expect(builder.joinMap.account).toBe(Account);
   });

   test(".join().select() produces a query with joinBy params", () => {
      const query = Order.join({ account: Account }).select({});
      const result = query.getSql({
         params: {
            joinBy: { account: { on: [["_.accountId", "=", "account.accountId"]] } },
         },
         options: { dialect: "sqlite" },
      });
      expect(result.text).toContain("JOIN");
      expect(result.text).toContain("account");
   });

   test("joinBy + filterBy with dot-notation on joined table", () => {
      const query = Order.join({ account: Account }).select({});
      const result = query.getSql({
         params: {
            joinBy: { account: { on: [["_.accountId", "=", "account.accountId"]] } },
            filterBy: [{ "account.email": "test@example.com" }],
         },
         options: { dialect: "sqlite" },
      });
      expect(result.text).toBeDefined();
      expect(result.values).toMatchInlineSnapshot(`
        [
          "test@example.com",
        ]
      `);
   });

   test("joinBy + orderBy with dot-notation on joined table", () => {
      const query = Order.join({ account: Account }).select({});
      const result = query.getSql({
         params: {
            joinBy: { account: { on: [["_.accountId", "=", "account.accountId"]] } },
            orderBy: { "account.email": "DESC" },
         },
         options: { dialect: "sqlite" },
      });
      expect(result.text).toContain("ORDER BY");
      expect(result.text).toContain("account");
   });

   test("joinBy + select (projection) with dot-notation", () => {
      const query = Order.join({ account: Account }).select({});
      const result = query.getSql({
         params: {
            joinBy: { account: { on: [["_.accountId", "=", "account.accountId"]] } },
            select: { orderId: true, "account.email": "account.email" },
         },
         options: { dialect: "sqlite" },
      });
      expect(result.text).toBeDefined();
   });
});

describe("Raw JOIN + joinBy coexistence", () => {
   beforeEach(() => {
      SqlTable.register(Account);
      SqlTable.register(Order);
      SqlTable.register(OrderItem);
      SqlTable.register(Product);
   });

   test("raw JOIN in args + joinBy in params both emit", () => {
      const query = Order.join({ account: Account }).select({
         JOIN: sql`JOIN "main"."product" ON "product"."product_id" = "order"."product_id"`,
      });
      const result = query.getSql({
         params: {
            joinBy: { account: { on: [["_.accountId", "=", "account.accountId"]] } },
         },
         options: { dialect: "sqlite" },
      });
      expect(result.text).toContain("product");
      expect(result.text).toContain("account");
   });

   test("raw JOIN without joinBy still works", () => {
      const query = Order.join({}).select({
         JOIN: sql`LEFT JOIN "main"."account" ON "account"."account_id" = "order"."account_id"`,
      });
      const result = query.getSql({
         params: {},
         options: { dialect: "sqlite" },
      });
      expect(result.text).toContain("LEFT JOIN");
   });

   test("joinBy without raw JOIN still works", () => {
      const query = Order.join({ account: Account }).select({});
      const result = query.getSql({
         params: {
            joinBy: { account: { on: [["_.accountId", "=", "account.accountId"]] } },
         },
         options: { dialect: "sqlite" },
      });
      expect(result.text).toContain("JOIN");
      expect(result.text).not.toContain("LEFT JOIN");
   });
});

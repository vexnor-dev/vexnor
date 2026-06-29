import { describe, expect, test, beforeEach } from "vitest";
import { Account, Order, OrderItem } from "@test-models/vexnor_dev.schema.js";
import { SqlTable } from "#src/core/schema/sql-table.js";
import { SqlBuildContext } from "#src/core/builder/sql-build-context.js";
import { SqlJoinBy } from "#src/core/operators/sql-join-by.js";

describe("SqlTable.join() + joinBy map shape", () => {
   beforeEach(() => {
      SqlTable.register(Account);
      SqlTable.register(Order);
      SqlTable.register(OrderItem);
   });

   test(".join() returns a SqlTableJoin builder", () => {
      const builder = Order.join({ account: Account });
      expect(builder.rootTable).toBe(Order);
      expect(builder.joinMap).toEqual({ account: Account });
   });

   test(".join() select() produces a query", () => {
      const query = Order.join({ account: Account }).select({});
      expect(query).toBeDefined();
      expect(query.source).toBeDefined();
   });

   test("joinBy map shape emits JOIN clause", () => {
      const joinBy = new SqlJoinBy(Order, "joinBy", undefined, { account: Account });
      const context = new SqlBuildContext({
         dialect: "sqlite",
         params: {
            joinBy: {
               account: { on: [["_.accountId", "=", "account.accountId"]] },
            },
         },
      });
      joinBy.write(context);
      expect(context.text).toMatchInlineSnapshot(`"JOIN "main"."account" ON "o_1"."account_id" = "a_2"."account_id""`);
   });

   test("joinBy map shape with explicit operator", () => {
      const joinBy = new SqlJoinBy(Order, "joinBy", undefined, { account: Account });
      const context = new SqlBuildContext({
         dialect: "sqlite",
         params: {
            joinBy: {
               account: { on: [["_.accountId", ">=", "account.accountId"]] },
            },
         },
      });
      joinBy.write(context);
      expect(context.text).toMatchInlineSnapshot(`"JOIN "main"."account" ON "o_1"."account_id" >= "a_2"."account_id""`);
   });

   test("joinBy map shape populates columnMap with dot-notation keys", () => {
      const joinBy = new SqlJoinBy(Order, "joinBy", undefined, { account: Account });
      const context = new SqlBuildContext({
         dialect: "sqlite",
         params: {
            joinBy: {
               account: { on: [["_.accountId", "=", "account.accountId"]] },
            },
         },
      });
      joinBy.write(context);
      expect(context.columnCount).toBeGreaterThan(0);
      expect(context.getColumn("account.email")).toBeDefined();
      expect(context.getColumn("account.firstName")).toBeDefined();
   });

   test("joinBy map shape with chained join", () => {
      const joinBy = new SqlJoinBy(OrderItem, "joinBy", undefined, { order: Order, account: Account });
      const context = new SqlBuildContext({
         dialect: "sqlite",
         params: {
            joinBy: {
               order: { on: [["_.orderId", "=", "order.orderId"]] },
            },
         },
      });
      joinBy.write(context);
      expect(context.text).toMatchInlineSnapshot(`"JOIN "main"."order" ON "oi_1"."order_id" = "o_2"."order_id""`);
   });

   test("dot-notation keys pass validation when join tables declared", () => {
      const query = Order.join({ account: Account }).select({});
      const result = query.getSql({
         params: {
            joinBy: { account: { on: [["_.accountId", "=", "account.accountId"]] } },
            filterBy: [{ "account.email": "test@test.com" }],
            orderBy: { "account.email": "ASC" },
         },
         options: { dialect: "sqlite" },
      });
      expect(result.text).toBeDefined();
      expect(result.values).toMatchInlineSnapshot(`
        [
          "test@test.com",
        ]
      `);
   });

   test("dot-notation in select (projection)", () => {
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

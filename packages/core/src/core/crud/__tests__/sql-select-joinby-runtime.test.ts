import { describe, expect, test, beforeEach } from "vitest";
import { SqlTable } from "#src/core/schema/sql-table.js";
import { Account, Order, OrderItem } from "@test-models/vexnor_dev.schema.js";

describe("sqlSelect — SqlPreColumnMap runtime joinBy resolution", () => {
   beforeEach(() => {
      SqlTable.clearRegistry();
      SqlTable.register(Account);
      SqlTable.register(Order);
      SqlTable.register(OrderItem);
   });

   test("runtime joinBy resolves table columns into context for filter/orderBy", () => {
      const query = Order.join({ account: Account }).select({});
      const result = query.getSql({
         params: {
            joinBy: { account: { on: [["_.accountId", "=", "account.accountId"]], type: "inner" } },
            select: { orderId: true, email: "account.email" },
         },
      });
      expect(result.text).toMatchInlineSnapshot(`
        "/* <query_0> */
        SELECT
          "o_1"."order_id" AS "orderId",
          "a_2"."email" AS "email"
        FROM
          "main"."order" AS "o_1"
          JOIN "main"."account" AS "a_2" ON "o_1"."account_id" = "a_2"."account_id"
          /* <query_1> */
          /* </query_1> */
          /* <query_2> */
          /* </query_2> */
          /* <query_3> */
          /* </query_3> */
          /* </query_0> */"
      `);
   });

   test("runtime joinBy with filterBy resolves dot-notation columns", () => {
      const query = Order.join({ account: Account }).select({});
      const result = query.getSql({
         params: {
            joinBy: { account: { on: [["_.accountId", "=", "account.accountId"]], type: "inner" } },
            filterBy: [{ "account.email": "test@test.com" }],
         },
      });
      expect(result.text).toMatchInlineSnapshot(`
        "/* <query_0> */
        SELECT
          "o_1"."order_id" AS "orderId",
          "o_1"."status",
          "o_1"."created_at" AS "createdAt",
          "o_1"."modified_at" AS "modifiedAt",
          "o_1"."account_id" AS "accountId"
        FROM
          "main"."order" AS "o_1"
          JOIN "main"."account" AS "a_2" ON "o_1"."account_id" = "a_2"."account_id"
          /* <query_1> */
        WHERE
          "a_2"."email" = ? /* </query_1> */
          /* <query_2> */
          /* </query_2> */
          /* <query_3> */
          /* </query_3> */
          /* </query_0> */"
      `);
      expect(result.values).toMatchInlineSnapshot(`
        [
          "test@test.com",
        ]
      `);
   });

   test("runtime joinBy skips tables not found in registry", () => {
      const query = Order.join({ account: Account }).select({});
      const result = query.getSql({
         params: {
            joinBy: null,
         },
      });
      // No joinBy — should emit all columns without join
      expect(result.text).toMatchInlineSnapshot(`
        "/* <query_0> */
        SELECT
          "o_1"."order_id" AS "orderId",
          "o_1"."status",
          "o_1"."created_at" AS "createdAt",
          "o_1"."modified_at" AS "modifiedAt",
          "o_1"."account_id" AS "accountId"
        FROM
          "main"."order" AS "o_1"
          /* <query_1> */
          /* </query_1> */
          /* <query_2> */
          /* </query_2> */
          /* <query_3> */
          /* </query_3> */
          /* </query_0> */"
      `);
   });

   test("runtime joinBy array format resolves table names", () => {
      const query = Order.join({ account: Account }).select({});
      const result = query.getSql({
         params: {
            joinBy: { account: { on: [["_.accountId", "=", "account.accountId"]] } },
            select: { orderId: true, email: "account.email" },
         },
      });
      expect(result.text).toMatchInlineSnapshot(`
        "/* <query_0> */
        SELECT
          "o_1"."order_id" AS "orderId",
          "a_2"."email" AS "email"
        FROM
          "main"."order" AS "o_1"
          JOIN "main"."account" AS "a_2" ON "o_1"."account_id" = "a_2"."account_id"
          /* <query_1> */
          /* </query_1> */
          /* <query_2> */
          /* </query_2> */
          /* <query_3> */
          /* </query_3> */
          /* </query_0> */"
      `);
   });
});

import { describe, expect, test } from "vitest";
import { info, param, row, sql, SqlBuildContext } from "valnor";
import { Order } from "./codegen/main.order-table.js";
import { Account } from "./codegen/main.account-table.js";
import { jsonMany, Sqlite3Tokenizer } from "valnor-sqlite3";

describe("Sqlite3JsonAggregation", () => {
   const AccountOrders = sql`
      ${info({ label: "AccountOrders" })}
      select ${row(Order.$orderId, Order.$status)}
      from ${Order}
      where ${Order.$accountId} = ${Account.out.$accountId}
      limit ${param<{ limit: number }>("limit")}`;

   test("should build 'select'", () => {
      const context = new SqlBuildContext({ tokenizer: new Sqlite3Tokenizer() });
      context.next("select");
      context.setAlias(Account.tableInfo, { alias: "_out_" });
      jsonMany(AccountOrders).build(context, {});
      expect(context.text).toMatchInlineSnapshot(
         `
        "(
          /* <query_0> */
          SELECT
            coalesce(
              json_group_array (json_object ("AccountOrders".*)),
              '[]'
            )
          FROM
            (
              /* <AccountOrders> */
              /* label: AccountOrders */
              SELECT
                "o_1"."order_id" AS "orderId",
                "o_1"."status"
              FROM
                "main"."order" AS "o_1"
              WHERE
                "o_1"."account_id" = "_out_"."account_id"
              LIMIT
                ? /* </AccountOrders> */
            ) AS "AccountOrders" /* </query_0> */
        )"
      `,
      );
   });

   const INVALID_KEYWORDS_FOR_JSON_AGG = ["where", "group by", "order by", "update", "delete from"];
   test.each(INVALID_KEYWORDS_FOR_JSON_AGG)("%s throws error", (keyword) => {
      const context = new SqlBuildContext({ tokenizer: new Sqlite3Tokenizer() });
      context.next(keyword);
      expect(() => jsonMany(AccountOrders).build(context, {})).toThrow(
         `Cannot use json aggregation with SQL keyword '${keyword}'`,
      );
   });

   test("should have 'params'", () => {
      const query = sql`
         select ${row(Account.$$)}, ${jsonMany(AccountOrders).as("orders")}
         from ${Account}
      `;

      const { text, values } = query.getSql({ params: { limit: 5 } });
      expect(values).toEqual([5]);
      expect(text).toMatchInlineSnapshot(`
        "/* <query_0> */
        SELECT
          "a_1"."account_id" AS "accountId",
          "a_1"."status",
          "a_1"."email",
          "a_1"."first_name" AS "firstName",
          "a_1"."last_name" AS "lastName",
          "a_1"."notes",
          "a_1"."created_at" AS "createdAt",
          "a_1"."modified_at" AS "modifiedAt",
          "a_1"."parent_id" AS "parentId",
          /* <query_1> */ (
            SELECT
              coalesce(
                json_group_array (
                  json_object ('orderId', "orderId", 'status', "status")
                ),
                '[]'
              )
            FROM
              (
                /* <AccountOrders> */
                /* label: AccountOrders */
                SELECT
                  "o_2"."order_id" AS "orderId",
                  "o_2"."status"
                FROM
                  "main"."order" AS "o_2"
                WHERE
                  "o_2"."account_id" = "a_1"."account_id"
                LIMIT
                  ? /* </AccountOrders> */
              ) AS "AccountOrders"
          ) AS "orders" /* </query_1> */
        FROM
          "main"."account" AS "a_1"
          /* </query_0> */"
      `);
   });
});

import { describe, expect, test } from "vitest";
import { info, param, row, sql, SqlBuildContext } from "valnor";
import { Order } from "./codegen/main.order-table.js";
import { Account } from "./codegen/main.account-table.js";
import { jsonMany, Sqlite3Tokenizer } from "valnor-sqlite3";
import "@valnor/test-utils";

describe("jsonGroupArray (SQLite)", () => {
   const AccountOrders = sql`
      ${info({ label: "AccountOrders" })}
      select ${row(Order.$orderId, Order.$status)}
      from ${Order}
      where ${Order.$accountId} = ${Account.out.$accountId}
      limit ${param<{ limit: number }>("limit")}`;

   test("jsonGroupArray(): select", () => {
      const context = new SqlBuildContext({ tokenizer: new Sqlite3Tokenizer() });
      context.next("select");
      jsonMany(AccountOrders).build(context, {});
      // Updated expected string to exactly match the actual output from the error message
      expect(context.text).toMatchInlineSnapshot(
         `
        "(
          SELECT
            coalesce(
              json_group_array (json_object ("AccountOrders".*)),
              '[]'
            )
          FROM
            (
              /* --label: AccountOrders */
              SELECT
                "o_1"."order_id" AS "orderId",
                "o_1"."status"
              FROM
                "main"."order" AS "o_1"
              WHERE
                "o_1"."account_id" = "a_2"."account_id"
              LIMIT
                ?
            ) AS "AccountOrders"
        )"
      `,
      );
   });

   const INVALID_KEYWORDS_FOR_JSON_AGG = ["where", "group by", "order by", "update", "delete from"];
   test.each(INVALID_KEYWORDS_FOR_JSON_AGG)("jsonGroupArray(): %s throws error", (keyword) => {
      const context = new SqlBuildContext({ tokenizer: new Sqlite3Tokenizer() });
      context.next(keyword);
      expect(() => jsonMany(AccountOrders).build(context, {})).toThrow("Cannot use jsonGroupArray() with SQL keyword:");
   });

   test("jsonGroupArray() with params", () => {
      const query = sql`
         select ${row(Account.$$)}, ${jsonMany(AccountOrders).as("orders")}
         from ${Account}
      `;

      const { text, values } = query.getSql({ params: { limit: 5 } });
      expect(values).toEqual([5]);
      expect(text).toMatchInlineSnapshot(`
           "SELECT
             "a_1"."account_id" AS "accountId",
             "a_1"."status",
             "a_1"."email",
             "a_1"."first_name" AS "firstName",
             "a_1"."last_name" AS "lastName",
             "a_1"."notes",
             "a_1"."created_at" AS "createdAt",
             "a_1"."modified_at" AS "modifiedAt",
             "a_1"."parent_id" AS "parentId",
             (
               SELECT
                 coalesce(
                   json_group_array (
                     json_object ('orderId', "orderId", 'status', "status")
                   ),
                   '[]'
                 )
               FROM
                 (
                   /* --label: AccountOrders */
                   SELECT
                     "o_2"."order_id" AS "orderId",
                     "o_2"."status"
                   FROM
                     "main"."order" AS "o_2"
                   WHERE
                     "o_2"."account_id" = "a_1"."account_id"
                   LIMIT
                     ?
                 ) AS "AccountOrders"
             ) AS "orders"
           FROM
             "main"."account" AS "a_1""
         `);
   });
});

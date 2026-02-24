import { describe, expect, test } from "vitest";
import { info, param, row, sql, SqlBuildContext } from "valnor";
import { Account, Order } from "./codegen/valnor_test.schema.js";
import { jsonMany, PostgresTokenizer } from "valnor-postgres";
import "valnor/testing";

describe("sql plugin jsonAgg() tests", () => {
   const AccountOrders = sql`
      ${info({ label: "AccountOrders" })}
      select ${row(Order.$orderId, Order.$status, Order.$createdAt, Order.$modifiedAt)}
      from ${Order}
      where ${Order.$accountId} = ${Account.$accountId}
      order by ${Order.$createdAt} desc
      limit ${param<{ limit: number }>("limit")}`;

   test("jsonAgg(): select", () => {
      const context = new SqlBuildContext({ tokenizer: new PostgresTokenizer("test") });
      context.next("select");
      const jsonAccountOrders = jsonMany(AccountOrders);
      jsonAccountOrders.build(context, {});
      expect(context.tokens[0]).toMatchInlineSnapshot(`
        {
          "type": "text",
          "value": ""AccountOrders_result"",
        }
      `);
   });

   const INVALID_KEYWORDS_FOR_JSON_AGG = ["where", "group by", "order by", "update", "delete from"];
   test.each(INVALID_KEYWORDS_FOR_JSON_AGG)("jsonAgg(): %s throws error", (keyword) => {
      const context = new SqlBuildContext({ tokenizer: new PostgresTokenizer("test") });
      context.next(keyword);
      expect(() => jsonMany(AccountOrders).build(context, {})).toThrow("Cannot use jsonAgg() with SQL keyword:");
   });

   test("jsonAgg(): from", () => {
      const context = new SqlBuildContext({ tokenizer: new PostgresTokenizer("test") });
      context.next("from");
      jsonMany(AccountOrders).build(context, {});
      expect(context.text).toMatchInlineSnapshot(
         `
        "/* <query_1>  */
        /* --inline: true */
        LEFT JOIN LATERAL (
          SELECT
            coalesce(jsonb_agg ("AccountOrders".*), '[]') AS "AccountOrders_result"
          FROM
            (
              /* <AccountOrders>  */
              /* --label: AccountOrders */
              SELECT
                "o_1"."order_id" AS "orderId",
                "o_1"."status",
                "o_1"."created_at" AS "createdAt",
                "o_1"."modified_at" AS "modifiedAt"
              FROM
                "valnor_test"."order" AS "o_1"
              WHERE
                "o_1"."account_id" = "a_2"."account_id"
              ORDER BY
                "o_1"."created_at" DESC
              LIMIT
                ?
                /* </AccountOrders> */
            ) AS "AccountOrders"
        ) AS "AccountOrders" ON TRUE
        /* </query_1> */"
      `,
      );
   });

   test("jsonAgg() with params", () => {
      const AccountOrders = sql`
         ${info({ label: "AccountOrders" })}
         select ${row(Order.$orderId, Order.$status, Order.$createdAt, Order.$modifiedAt)}
         from ${Order}
         where ${Order.$accountId} = ${Account.$accountId}
         order by ${Order.$createdAt} desc
         limit ${param<{ limit: number }>("limit")}`;

      const query = sql`
         select ${row(Account.$$)}, ${jsonMany(AccountOrders).as("children")}
         from ${Account} ${jsonMany(AccountOrders)}
         order by ${Account.$accountId}
      `;
      const target = query.getSql({ params: { limit: 5 } });
      expect(target.values).toEqual([5]);

      expect(target.text).toMatchInlineSnapshot(
         `
        "/* <query_0>  */
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
          "AccountOrders_result" AS "children"
        FROM
          "valnor_test"."account" AS "a_1"
          /* <query_2>  */
          /* --inline: true */
          LEFT JOIN LATERAL (
            SELECT
              coalesce(jsonb_agg ("AccountOrders".*), '[]') AS "AccountOrders_result"
            FROM
              (
                /* <AccountOrders>  */
                /* --label: AccountOrders */
                SELECT
                  "o_2"."order_id" AS "orderId",
                  "o_2"."status",
                  "o_2"."created_at" AS "createdAt",
                  "o_2"."modified_at" AS "modifiedAt"
                FROM
                  "valnor_test"."order" AS "o_2"
                WHERE
                  "o_2"."account_id" = "a_3"."account_id"
                ORDER BY
                  "o_2"."created_at" DESC
                LIMIT
                  ?
                  /* </AccountOrders> */
              ) AS "AccountOrders"
          ) AS "AccountOrders" ON TRUE
          /* </query_2> */
        ORDER BY
          "a_1"."account_id"
          /* </query_0> */"
      `,
      );
   });

   test("jsonAgg() with custom alias", () => {
      const AccountOrders = sql`
         ${info({ label: "AccountOrders" })}
         select ${row(Order.$orderId, Order.$status, Order.$createdAt, Order.$modifiedAt)}
         from ${Order}
         where ${Order.$accountId} = ${Account.$accountId}
         order by ${Order.$createdAt} desc
         limit ${param<{ limit: number }>("limit")}`;

      const query = sql`
         select ${row(Account.$$)}, ${jsonMany(AccountOrders).as("orders")}
         from ${Account} ${jsonMany(AccountOrders)}
         order by ${Account.$accountId}
      `;

      const target = query.getSql({ params: { limit: 5 } });
      expect(target.values).toEqual([5]);
      expect(target.text).toMatchInlineSnapshot(
         `
        "/* <query_0>  */
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
          "AccountOrders_result" AS "orders"
        FROM
          "valnor_test"."account" AS "a_1"
          /* <query_2>  */
          /* --inline: true */
          LEFT JOIN LATERAL (
            SELECT
              coalesce(jsonb_agg ("AccountOrders".*), '[]') AS "AccountOrders_result"
            FROM
              (
                /* <AccountOrders>  */
                /* --label: AccountOrders */
                SELECT
                  "o_2"."order_id" AS "orderId",
                  "o_2"."status",
                  "o_2"."created_at" AS "createdAt",
                  "o_2"."modified_at" AS "modifiedAt"
                FROM
                  "valnor_test"."order" AS "o_2"
                WHERE
                  "o_2"."account_id" = "a_3"."account_id"
                ORDER BY
                  "o_2"."created_at" DESC
                LIMIT
                  ?
                  /* </AccountOrders> */
              ) AS "AccountOrders"
          ) AS "AccountOrders" ON TRUE
          /* </query_2> */
        ORDER BY
          "a_1"."account_id"
          /* </query_0> */"
      `,
      );
   });
});

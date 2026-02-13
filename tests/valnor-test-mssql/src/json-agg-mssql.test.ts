import { describe, expect, test } from "vitest";
import { info, param, row, sql, SqlBuildContext } from "valnor";
import { Account, Order } from "./codegen/valnor_test.schema.js";
import { jsonMany, MssqlParamFormatter, MssqlTokenizer } from "valnor-mssql";
import "valnor/testing";

describe("sql plugin jsonAgg() tests", () => {
   const AccountOrders = sql`
      ${info({ label: "AccountOrders" })}
      select ${row(Order.$orderId, Order.$status, Order.$createdAt, Order.$modifiedAt)}
      from ${Order}
      where ${Order.$accountId} = ${Account.$accountId}
      order by ${Order.$createdAt} desc
      offset 0 rows fetch next ${param<{ limit: number }>("limit")} rows only`;

   test("jsonAgg(): select build", () => {
      const context = new SqlBuildContext({ tokenizer: new MssqlTokenizer("test") });
      context.next("select");
      jsonMany(AccountOrders).build(context, {});
      expect(context.text).toMatchInlineSnapshot(`""AccountOrders_result"."AccountOrders""`);
   });

   test("jsonAgg(): from", () => {
      const context = new SqlBuildContext({ dialect: "postgresql", tokenizer: new MssqlTokenizer("test") });
      context.next("from");
      jsonMany(AccountOrders).build(context, {});
      expect(context.text).toMatchInlineSnapshot(`
        "OUTER apply (
          SELECT
            coalesce(
              (
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
                OFFSET
                  0 rows
                FETCH NEXT
                  ? rows ONLY FOR json path,
                  include_null_values
              ),
              '[]'
            ) AS "AccountOrders"
        ) AS "AccountOrders_result""
      `);
   });

   test("jsonAgg() with params", () => {
      const query = sql`
         select ${row(Account.$$)}, ${jsonMany(AccountOrders).as("orders")}
         from ${Account} ${jsonMany(AccountOrders)}
         where ${Account.$email} = ${param<{ email: string }>("email")}
         order by ${Account.$accountId}
      `;

      const { text, values } = query.getSql({
         params: { email: "test@example.com", limit: 5 },
         options: { paramFormat: MssqlParamFormatter, dialect: "tsql" },
      });

      expect(values).toMatchInlineSnapshot(`
        [
          5,
          "test@example.com",
        ]
      `);
      expect(text).toMatchInlineSnapshot(`
        "SELECT
          "a_1"."account_id" AS "accountId",
          "a_1"."parent_id" AS "parentId",
          "a_1"."status",
          "a_1"."email",
          "a_1"."first_name" AS "firstName",
          "a_1"."last_name" AS "lastName",
          "a_1"."notes",
          "a_1"."created_at" AS "createdAt",
          "a_1"."modified_at" AS "modifiedAt",
          "AccountOrders_result"."AccountOrders" AS "orders"
        FROM
          "valnor_test"."account" AS "a_1"
          OUTER APPLY (
            SELECT
              coalesce(
                (
                  /* --label: AccountOrders */
                  SELECT
                    "o_2"."order_id" AS "orderId",
                    "o_2"."status",
                    "o_2"."created_at" AS "createdAt",
                    "o_2"."modified_at" AS "modifiedAt"
                  FROM
                    "valnor_test"."order" AS "o_2"
                  WHERE
                    "o_2"."account_id" = "a_1"."account_id"
                  ORDER BY
                    "o_2"."created_at" DESC
                  OFFSET
                    0 rows
                  FETCH NEXT
                    @param_0 rows only
                  FOR JSON
                    path,
                    include_null_values
                ),
                '[]'
              ) AS "AccountOrders"
          ) AS "AccountOrders_result"
        WHERE
          "a_1"."email" = @param_1
        ORDER BY
          "a_1"."account_id""
      `);
   });
});

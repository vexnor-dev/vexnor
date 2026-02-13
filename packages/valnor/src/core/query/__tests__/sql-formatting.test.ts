import { describe, expect, test } from "vitest";
import { format } from "sql-formatter";

describe("SQL Formatting", () => {
   test("", () => {
      const input = `outer apply (
select coalesce((

      
/* --label: AccountOrders */

      select "o_1"."order_id" as "orderId", "o_1"."status", "o_1"."created_at" as "createdAt", "o_1"."modified_at" as "modifiedAt"
      from "valnor_test"."order" as "o_1"
      where "o_1"."account_id" = "a_2"."account_id"
      order by "o_1"."created_at" desc
      offset 0 rows fetch next @limit rows only
for json path, include_null_values), '[]'
) as "AccountOrders")
as "AccountOrders_result"`;
      const actual = format(input, { language: "tsql", keywordCase: "upper" });
      expect(actual).toMatchInlineSnapshot(`
        "OUTER APPLY (
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
                  @limit rows only
                FOR JSON
                  path,
                  include_null_values
              ),
              '[]'
            ) AS "AccountOrders"
        ) AS "AccountOrders_result""
      `);
   });
});

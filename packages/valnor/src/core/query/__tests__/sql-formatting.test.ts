import { describe, test } from "vitest";
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
      console.log(actual);
   });
});

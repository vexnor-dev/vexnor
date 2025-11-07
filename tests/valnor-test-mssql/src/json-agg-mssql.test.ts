import { describe, expect, test } from "vitest";
import { info, param, row, sql, SqlQueryContext } from "valnor";
import { Account, Order } from "./codegen/valnor_test.schema.js";
import { jsonAgg, MssqlParamFormatter, MssqlTokenizer } from "valnor-mssql";
import "@valnor/test-utils";

describe("sql plugin jsonAgg() tests", () => {
   const AccountOrders = sql`
      ${info({ label: "AccountOrders" })}
      select ${row(Order.orderId, Order.status, Order.createdAt, Order.modifiedAt)}
      from ${Order}
      where ${Order.accountId} = ${Account.accountId}
      order by ${Order.createdAt} desc
      offset 0 rows fetch next ${param("limit").is<number>()} rows only`;

   test("jsonAgg(): select build", () => {
      const context = new SqlQueryContext({ queryName: "test", tokenizer: new MssqlTokenizer("test") });
      context.next("select");
      jsonAgg(AccountOrders).$$build(context, {});
      expect(context.strings[0]).toBe(`"AccountOrders_result"."AccountOrders"`);
   });

   test("jsonAgg(): select in query", () => {
      const query = sql`
         SELECT ${jsonAgg(AccountOrders)}
      `;

      expect(query.getText({}, MssqlParamFormatter)).toEqualQuery(`SELECT "AccountOrders_result"."AccountOrders"`);
   });

   // test.each(SQL_KEYWORDS.filter((z) => !["select", "from"].includes(z)))("jsonAgg(): %s throws error", (keyword) => {
   //    const context = new SqlQueryContext({ queryName: "test", keywords: [keyword] });
   //    expect(() => jsonAgg(AccountOrders).select.build(context, {})).toThrow("Cannot use jsonAgg() with SQL keyword:");
   // });

   test("jsonAgg(): from", () => {
      const context = new SqlQueryContext({ queryName: "test", tokenizer: new MssqlTokenizer("test") });
      context.next("from");
      jsonAgg(AccountOrders).$$build(context, {});
      expect(context.text).toEqualQuery(
         `
            outer apply (
               select coalesce((
                     /* --label: AccountOrders */
                     select "o_1"."order_id" as "orderId",
                            "o_1"."status",
                            "o_1"."created_at" as "createdAt",
                            "o_1"."modified_at" as "modifiedAt"
                     from "valnor_test"."order" as "o_1"
                     where "o_1"."account_id" = "a_2"."account_id"
                     order by "o_1"."created_at" desc
                     offset 0 rows fetch next $limit rows only
                     for json path, include_null_values
                  ), '[]') as "AccountOrders") as "AccountOrders_result"
         `,
      );
   });

   test("jsonAgg() with params", () => {
      const query = sql`
         select ${row(Account.$all)}, ${jsonAgg(AccountOrders)} as "orders"
         from ${Account} ${jsonAgg(AccountOrders)}
         where ${Account.email} = ${param("email")}
         order by ${Account.accountId}
      `;

      expect(query.getText({ params: { email: "test@example.com", limit: 5 } }, MssqlParamFormatter)).toEqualQuery(
         `select "a_1"."account_id"                     as "accountId",
                 "a_1"."parent_id"                      as "parentId",
                 "a_1"."status",
                 "a_1"."email",
                 "a_1"."first_name"                     as "firstName",
                 "a_1"."last_name"                      as "lastName",
                 "a_1"."notes",
                 "a_1"."created_at"                     as "createdAt",
                 "a_1"."modified_at"                    as "modifiedAt",
                 "AccountOrders_result"."AccountOrders" as "orders"
          from "valnor_test"."account" as "a_1" outer apply (
               select coalesce((
                     /* --label: AccountOrders */
                     select "o_2"."order_id" as "orderId",
                            "o_2"."status",
                            "o_2"."created_at" as "createdAt",
                            "o_2"."modified_at" as "modifiedAt"
                     from "valnor_test"."order" as "o_2"
                     where "o_2"."account_id" = "a_1"."account_id"
                     order by "o_2"."created_at" desc
                     offset 0 rows fetch next @param_0 rows only
                 for json path, include_null_values
                 ), '[]') as "AccountOrders") as "AccountOrders_result"
          where "a_1"."email" = @param_1
          order by "a_1"."account_id" asc`,
      );
   });
});

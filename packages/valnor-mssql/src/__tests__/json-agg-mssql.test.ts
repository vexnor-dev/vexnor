import { describe, expect, test } from "vitest";
import { info, param, sql, SqlQueryContext, trim } from "valnor";
import { Account, IAccountSelect, IOrderSelect, Order } from "./codegen/one_sql.schema.js";
import { jsonAgg } from "../json-agg-mssql.js";
import { MssqlQueryHandler } from "../mssql-query-handler.js";
import { MssqlTokenizer } from "../mssql-tokenizer.js";

describe("sql plugin jsonAgg() tests", () => {
   const AccountOrders = sql<IOrderSelect, { limit: 5 }>`
      ${info({ label: "AccountOrders" })}
      select ${Order.orderId}, ${Order.status}, ${Order.createdAt}, ${Order.modifiedAt}
      from ${Order}
      where ${Order.accountId} = ${Account.accountId}
      order by ${Order.createdAt} desc
      offset 0 rows fetch next ${param("limit")} rows only`;

   test("jsonAgg(): select build", () => {
      const context = new SqlQueryContext({ queryName: "test", tokenizer: new MssqlTokenizer("test") });
      context.next("select");
      jsonAgg(AccountOrders).select.build(context, {});
      expect(context.strings[0]).toBe(`"AccountOrders_result"."AccountOrders"`);
   });

   test("jsonAgg(): select in query", () => {
      const query = sql<object>`
         SELECT ${jsonAgg(AccountOrders).select}
      `;

      expect(trim(query.getText({}, MssqlQueryHandler.paramFormat))).toBe(
         trim(`SELECT "AccountOrders_result"."AccountOrders"`),
      );
   });

   // test.each(SQL_KEYWORDS.filter((z) => !["select", "from"].includes(z)))("jsonAgg(): %s throws error", (keyword) => {
   //    const context = new SqlQueryContext({ queryName: "test", keywords: [keyword] });
   //    expect(() => jsonAgg(AccountOrders).select.build(context, {})).toThrow("Cannot use jsonAgg() with SQL keyword:");
   // });

   test("jsonAgg(): from", () => {
      const context = new SqlQueryContext({ queryName: "test", tokenizer: new MssqlTokenizer("test") });
      context.next("from");
      jsonAgg(AccountOrders).body.build(context, {});
      expect(trim(context.strings.join(""))).toBe(
         trim`
            outer apply (
               select coalesce((
                     /* --label: AccountOrders */
                     select "order_1"."order_id" as "orderId",
                            "order_1"."status",
                            "order_1"."created_at" as "createdAt",
                            "order_1"."modified_at" as "modifiedAt"
                     from "one_sql"."order" as "order_1"
                     where "order_1"."account_id" = "account_1"."account_id"
                     order by "order_1"."created_at" desc
                     offset 0 rows fetch next $limit rows only
                     for json path
                  ), '[]') as "AccountOrders") as "AccountOrders_result"
         `,
      );
   });

   test("jsonAgg() with params", () => {
      const query = sql<IAccountSelect, { email: string; limit: number }>`
         select ${Account.$$all}, ${jsonAgg(AccountOrders).select} as "orders"
         from ${Account} ${jsonAgg(AccountOrders).body}
         where ${Account.email} = ${param("email")}
         order by ${Account.accountId} asc
      `;

      expect(
         trim(query.getText({ params: { email: "test@example.com", limit: 5 } }, MssqlQueryHandler.paramFormat)),
      ).toBe(
         trim`select "account_1"."account_id"               as "accountId",
                     "account_1"."status",
                     "account_1"."email",
                     "account_1"."first_name"               as "firstName",
                     "account_1"."last_name"                as "lastName",
                     "account_1"."notes",
                     "account_1"."created_at"               as "createdAt",
                     "account_1"."modified_at"              as "modifiedAt",
                     "AccountOrders_result"."AccountOrders" as "orders"
              from "one_sql"."account" as "account_1" outer apply (
               select coalesce((
                     /* --label: AccountOrders */
                     select "order_1"."order_id" as "orderId",
                            "order_1"."status",
                            "order_1"."created_at" as "createdAt",
                            "order_1"."modified_at" as "modifiedAt"
                     from "one_sql"."order" as "order_1"
                     where "order_1"."account_id" = "account_1"."account_id"
                     order by "order_1"."created_at" desc
                     offset 0 rows fetch next @param_0 rows only
                 for json path
                 ), '[]') as "AccountOrders") as "AccountOrders_result"
              where "account_1"."email" = @param_1
              order by "account_1"."account_id" asc`,
      );
   });
});

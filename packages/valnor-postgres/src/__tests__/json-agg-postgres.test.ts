import { describe, expect, test } from "vitest";
import { info, param, sql, trim, SqlQueryContext } from "valnor";
import { IOrderSelect, Order } from "./codegen/one_sql.order-table.js";
import { Account, IAccountSelect } from "./codegen/one_sql.account-table.js";
import { jsonAgg } from "../json-agg-postgres.js";
import { PostgresTokenizer } from "../postgres-tokenizer.js";

describe("sql plugin jsonAgg() tests", () => {
   const AccountOrders = sql<IOrderSelect, { limit: 5 }>`
      ${info({ label: "AccountOrders" })}
      select ${Order.orderId}, ${Order.status}, ${Order.createdAt}, ${Order.modifiedAt}
      from ${Order}
      where ${Order.accountId} = ${Account.accountId}
      order by ${Order.createdAt} desc
      limit ${param("limit")}`;

   test("jsonAgg(): select", () => {
      const context = new SqlQueryContext({ queryName: "test", tokenizer: new PostgresTokenizer("test") });
      context.next("select");
      jsonAgg(AccountOrders).build(context, {});
      expect(context.strings[0]).toBe(`"AccountOrders_result"`);
   });

   const INVALID_KEYWORDS_FOR_JSON_AGG = ['where', 'group by', 'order by', 'update', 'delete from'];
   test.each(INVALID_KEYWORDS_FOR_JSON_AGG)("jsonAgg(): %s throws error", (keyword) => {
      const context = new SqlQueryContext({ queryName: "test", tokenizer: new PostgresTokenizer("test") });
      context.next(keyword);
      expect(() => jsonAgg(AccountOrders).build(context, {})).toThrow("Cannot use jsonAgg() with SQL keyword:");
   });

   test("jsonAgg(): from", () => {
      const context = new SqlQueryContext({ queryName: "test", tokenizer: new PostgresTokenizer("test") });
      context.next("from");
      jsonAgg(AccountOrders).build(context, {});
      expect(trim(context.strings.join(""))).toBe(
         trim`
            left join lateral (
               select coalesce(jsonb_agg("AccountOrders".*), '[]') as "AccountOrders_result"
               from ( /* --label: AccountOrders */
                       select "order_1"."order_id"   as "orderId",
                              "order_1"."status",
                              "order_1"."created_at" as "createdAt",
                              "order_1"."modified_at" as "modifiedAt"
                       from "one_sql"."order" as "order_1"
                       where "order_1"."account_id" = "account_1"."account_id"
                       order by "order_1"."created_at" desc
                       limit $limit) as "AccountOrders") as "AccountOrders" on true
         `,
      );
   });

   test("jsonAgg() with params", () => {
      const AccountOrders = sql<IOrderSelect, { limit: 5 }>`
         ${info({ label: "AccountOrders" })}
         select ${Order.orderId}, ${Order.status}, ${Order.createdAt}, ${Order.modifiedAt}
         from ${Order}
         where ${Order.accountId} = ${Account.accountId}
         order by ${Order.createdAt} desc
         limit ${param("limit")}`;

      const query = sql<IAccountSelect, { email: string; limit: number }>`
         select ${Account.$$all}, ${jsonAgg(AccountOrders)} as "orders"
         from ${Account} ${jsonAgg(AccountOrders)}
         order by ${Account.accountId} asc
      `;

      expect(trim(query.getSql({ params: { email: "test@example.com", limit: 5 } }))).toBe(
         trim`select "account_1"."first_name"  as "firstName",
                     "account_1"."account_id"  as "accountId",
                     "account_1"."status",
                     "account_1"."created_at"  as "createdAt",
                     "account_1"."modified_at" as "modifiedAt",
                     "account_1"."last_name"   as "lastName",
                     "account_1"."notes",
                     "account_1"."email",
                     "AccountOrders_result"  as "orders"
              from "one_sql"."account" as "account_1"
                      left join lateral (
                 select coalesce(jsonb_agg("AccountOrders".*), '[]') as "AccountOrders_result"
                 from (
                         /* --label: AccountOrders */
                         select "order_1"."order_id"    as "orderId",
                                "order_1"."status",
                                "order_1"."created_at"  as "createdAt",
                                "order_1"."modified_at" as "modifiedAt"
                         from "one_sql"."order" as "order_1"
                         where "order_1"."account_id" = "account_1"."account_id"
                         order by "order_1"."created_at" desc
                         limit ?) as "AccountOrders") as "AccountOrders" on true
              order by "account_1"."account_id" asc`,
      );
   });

   test("jsonAgg() with custom alias", () => {
      const AccountOrders = sql<IOrderSelect, { limit: 5 }>`
         ${info({ label: "AccountOrders" })}
         select ${Order.orderId}, ${Order.status}, ${Order.createdAt}, ${Order.modifiedAt}
         from ${Order}
         where ${Order.accountId} = ${Account.accountId}
         order by ${Order.createdAt} desc
         limit ${param("limit")}`;

      const query = sql<IAccountSelect, { email: string; limit: number }>`
         select ${Account.$$all}, ${jsonAgg(AccountOrders)} as "orders"
         from ${Account} ${jsonAgg(AccountOrders)}
         order by ${Account.accountId} asc
      `;

      expect(trim(query.getSql({ params: { email: "test@example.com", limit: 5 } }))).toBe(
         trim`select "account_1"."first_name"  as "firstName",
                     "account_1"."account_id"  as "accountId",
                     "account_1"."status",
                     "account_1"."created_at"  as "createdAt",
                     "account_1"."modified_at" as "modifiedAt",
                     "account_1"."last_name"   as "lastName",
                     "account_1"."notes",
                     "account_1"."email",
                     "AccountOrders_result"           as "orders"
              from "one_sql"."account" as "account_1"
                      left join lateral (
                 select coalesce(jsonb_agg("AccountOrders".*), '[]') as "AccountOrders_result"
                 from (
                         /* --label: AccountOrders */
                         select "order_1"."order_id"    as "orderId",
                                "order_1"."status",
                                "order_1"."created_at"  as "createdAt",
                                "order_1"."modified_at" as "modifiedAt"
                         from "one_sql"."order" as "order_1"
                         where "order_1"."account_id" = "account_1"."account_id"
                         order by "order_1"."created_at" desc
                         limit ?) as "AccountOrders") as "AccountOrders" on true
              order by "account_1"."account_id" asc`,
      );
   });
});

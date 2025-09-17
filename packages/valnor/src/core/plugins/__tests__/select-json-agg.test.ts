import { describe, expect, test, vi } from "vitest";
import { IOrderSelect, Order } from "../../__tests__/codegen/one_sql.order-table.js";
import { info, jsonAgg, param, sql } from "valnor";
import { Account, IAccountSelect } from "../../__tests__/codegen/one_sql.account-table.js";
import { trim } from "../../__tests__/utils.js";
import { SqlQueryContext } from "../../sql-query-context.js";
import { SQL_KEYWORDS } from "../../sql-keyword.js";

vi.mock("../../random-name.js", () => ({
   randomName: (name: string) => (name === "account" ? "account" : name === "order" ? "order" : name),
}));

describe("sql plugin jsonAgg() tests", () => {
   const AccountOrders = sql<IOrderSelect, { limit: 5 }>`
      ${info({ label: "AccountOrders" })}
      select ${Order.orderId}, ${Order.status}, ${Order.createdAt}, ${Order.modifiedAt}
      from ${Order}
      where ${Order.accountId} = ${Account.accountId}
      order by ${Order.createdAt} desc
      limit ${param("limit")}`;

   test("jsonAgg(): select", () => {
      const context = new SqlQueryContext({ queryName: "test", keywords: ["select"] });
      jsonAgg(AccountOrders).build(context);
      expect(context.strings[0]).toBe(`"${AccountOrders.name}_result"`);
   });

   test.each(SQL_KEYWORDS.filter((z) => !["select", "from"].includes(z)))("jsonAgg(): %s throws error", (keyword) => {
      const context = new SqlQueryContext({ queryName: "test", keywords: [keyword] });
      expect(() => jsonAgg(AccountOrders).build(context)).toThrow("Cannot use jsonAgg() with SQL keyword:");
   });

   test("jsonAgg(): from", () => {
      const context = new SqlQueryContext({ queryName: "test", keywords: ["from"] });
      jsonAgg(AccountOrders).build(context);
      expect(trim(context.strings.join(""))).toBe(
         trim`
            left join lateral (
               select coalesce(jsonb_agg("AccountOrders".*), '[]') as "AccountOrders_result"
               from ( /* --label: AccountOrders */
                       select "order"."order_id"   as "orderId",
                              "order"."status",
                              "order"."created_at" as "createdAt",
                              "order"."modified_at" as "modifiedAt"
                       from "one_sql"."order"
                       where "order"."account_id" = "account"."account_id"
                       order by "order"."created_at" desc
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

      expect(trim(query.getSql({ email: "test@example.com", limit: 5 }))).toBe(
         trim`select "account"."first_name"  as "firstName",
                     "account"."account_id"  as "accountId",
                     "account"."status",
                     "account"."created_at"  as "createdAt",
                     "account"."modified_at" as "modifiedAt",
                     "account"."last_name"   as "lastName",
                     "account"."notes",
                     "account"."email",
                     "AccountOrders_result"  as "orders"
              from "one_sql"."account"
                      left join lateral (
                 select coalesce(jsonb_agg("AccountOrders".*), '[]') as "AccountOrders_result"
                 from (
                         /* --label: AccountOrders */
                         select "order"."order_id"    as "orderId",
                                "order"."status",
                                "order"."created_at"  as "createdAt",
                                "order"."modified_at" as "modifiedAt"
                         from "one_sql"."order"
                         where "order"."account_id" = "account"."account_id"
                         order by "order"."created_at" desc
                         limit ?) as "AccountOrders") as "AccountOrders" on true
              order by "account"."account_id" asc`,
      );
   });
});

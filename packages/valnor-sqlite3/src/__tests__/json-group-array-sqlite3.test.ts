import { describe, expect, test } from "vitest";
import { info, param, sql, SQL_KEYWORDS, SqlQueryContext, trim } from "valnor";
import { jsonGroupArray } from "../json-group-array-sqlite3.js";
import { IOrderSelect, Order } from "./codegen/main.order-table.js";
import { Account, IAccountSelect } from "./codegen/main.account-table.js";

describe("jsonAgg (SQLite)", () => {
   const AccountOrders = sql<IOrderSelect, { limit: number }>`
      ${info({ label: "AccountOrders" })}
      select ${Order.orderId}, ${Order.status}
      from ${Order}
      where ${Order.accountId} = ${Account.accountId}
      limit ${param("limit")}`;

   test("jsonAgg(): select", () => {
      const context = new SqlQueryContext({ queryName: "test", keywords: ["select"] });
      jsonGroupArray(AccountOrders).build(context, {});
      expect(context.strings[0]).toBe(`"AccountOrders_result"`);
   });

   test.each(SQL_KEYWORDS.filter((z) => !["select", "from"].includes(z)))("jsonAgg(): %s throws error", (keyword) => {
      const context = new SqlQueryContext({ queryName: "test", keywords: [keyword] });
      expect(() => jsonGroupArray(AccountOrders).build(context, {})).toThrow("Cannot use jsonAgg() with SQL keyword:");
   });

   test("jsonAgg(): from", () => {
      const context = new SqlQueryContext({ queryName: "test", keywords: ["from"] });
      jsonGroupArray(AccountOrders).build(context, {});
      expect(trim(context.strings.join(""))).toBe(
         trim`
            left join lateral (
               select coalesce(json_group_array(json_object("AccountOrders".*)), '[]') as "AccountOrders_result"
               from ( /* --label: AccountOrders */
                       select "order_1"."order_id" as "orderId", "order_1"."status"
                       from "main"."order" as "order_1"
                       where "order_1"."account_id" = "account_1"."account_id"
                       limit $limit) as "AccountOrders") as "AccountOrders" on true
         `,
      );
   });

   test("jsonAgg() with params", () => {
      const query = sql<IAccountSelect & { orders: IOrderSelect[] }, { limit: number }>`
         select ${Account.$$all}, ${jsonGroupArray(AccountOrders)} as "orders"
         from ${Account} ${jsonGroupArray(AccountOrders)}
      `;

      expect(trim(query.getSql({ params: { limit: 5 } }))).toBe(
         trim`select "account_1"."account_id"  as "accountId",
                     "account_1"."status",
                     "account_1"."email",
                     "account_1"."first_name"  as "firstName",
                     "account_1"."last_name"   as "lastName",
                     "account_1"."notes",
                     "account_1"."created_at"  as "createdAt",
                     "account_1"."modified_at" as "modifiedAt",
                     "AccountOrders_result"    as "orders"
              from "main"."account" as "account_1"
                      left join lateral (
                 select coalesce(json_group_array(json_object("AccountOrders".*)),
                                 '[]') as "AccountOrders_result"
                 from (
                         /* --label: AccountOrders */
                         select "order_1"."order_id" as "orderId", "order_1"."status"
                         from "main"."order" as "order_1"
                         where "order_1"."account_id" = "account_1"."account_id"
                         limit ?) as "AccountOrders") as "AccountOrders" on true`,
      );
   });
});

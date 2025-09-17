import { describe, expect, test, vi } from "vitest";
import { info, param, sql, trim, SqlQueryContext, SQL_KEYWORDS } from "valnor/core";
import { IOrderSelect, Order } from "./codegen/one_sql.order-table.js";
import { Account, IAccountSelect } from "./codegen/one_sql.account-table.js";
import { jsonAgg } from "../select-json-agg.js";

vi.mock("node:crypto", async () => {
   const actual = await vi.importActual("node:crypto");
   return {
      ...actual,
      default: {
         ...(actual.default as object),
         randomBytes: () => ({ toString: () => "" }),
      },
      randomBytes: () => ({ toString: () => "" }),
   };
});

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
                       select "order_"."order_id"   as "orderId",
                              "order_"."status",
                              "order_"."created_at" as "createdAt",
                              "order_"."modified_at" as "modifiedAt"
                       from "one_sql"."order" as "order_"
                       where "order_"."account_id" = "account_"."account_id"
                       order by "order_"."created_at" desc
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
         trim`select "account_"."first_name"  as "firstName",
                     "account_"."account_id"  as "accountId",
                     "account_"."status",
                     "account_"."created_at"  as "createdAt",
                     "account_"."modified_at" as "modifiedAt",
                     "account_"."last_name"   as "lastName",
                     "account_"."notes",
                     "account_"."email",
                     "AccountOrders_result"  as "orders"
              from "one_sql"."account" as "account_"
                      left join lateral (
                 select coalesce(jsonb_agg("AccountOrders".*), '[]') as "AccountOrders_result"
                 from (
                         /* --label: AccountOrders */
                         select "order_"."order_id"    as "orderId",
                                "order_"."status",
                                "order_"."created_at"  as "createdAt",
                                "order_"."modified_at" as "modifiedAt"
                         from "one_sql"."order" as "order_"
                         where "order_"."account_id" = "account_"."account_id"
                         order by "order_"."created_at" desc
                         limit ?) as "AccountOrders") as "AccountOrders" on true
              order by "account_"."account_id" asc`,
      );
   });
});

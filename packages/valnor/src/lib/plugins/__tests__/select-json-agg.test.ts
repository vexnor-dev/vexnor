import { describe, expect, test } from "vitest";
import { IOrdersSelect, Orders } from "../../__tests__/types/orders-model.js";
import { info } from "../sql-info.js";
import { IUsersSelect, Users } from "../../__tests__/types/index.js";
import { param } from "../../sql-param.js";
import { jsonAgg } from "../select-json-agg.js";
import { trim } from "../../__tests__/utils.js";
import { SqlQueryContext } from "../../sql-query-context.js";
import { sql } from "../../sql.js";

describe("sql plugin jsonAgg() tests", () => {
   const UserOrders = sql<IOrdersSelect, { limit: 5 }>`
      ${info({ label: "UserOrders" })}
      select ${Orders.orderId}, ${Orders.status}, ${Orders.total}, ${Orders.createdAt}, ${Orders.updatedAt}
      from ${Orders}
      where ${Orders.userId} = ${Users.userId}
      order by ${Orders.createdAt} desc
      limit ${param("limit")}`;

   test("jsonAgg(): select", () => {
      const context = new SqlQueryContext({ queryName: "test", keywords: ["select"] });
      jsonAgg(UserOrders).build(context);
      expect(context.strings[0]).toBe(`"${UserOrders.name}_result"`);
   });

   test("jsonAgg(): from", () => {
      const context = new SqlQueryContext({ queryName: "test", keywords: ["from"] });
      expect(() => jsonAgg(UserOrders).build(context)).toThrow("Cannot use jsonAgg() with SQL keyword:");
   });

   test("jsonAgg(): join", () => {
      const context = new SqlQueryContext({ queryName: "test", keywords: ["join"] });
      jsonAgg(UserOrders).build(context);
      expect(trim(context.strings.join(""))).toBe(
         trim`
            select coalesce(jsonb_agg("UserOrders".*), '[]') as "UserOrders_result"
            from (/* --label: UserOrders */
                    select "orders_1"."order_id"   as "orderId",
                           "orders_1"."status",
                           "orders_1"."total",
                           "orders_1"."created_at" as "createdAt",
                           "orders_1"."updated_at" as "updatedAt"
                    from "public"."orders" as "orders_1"
                    where "orders_1"."user_id" = "users_1"."user_id"
                    order by "orders_1"."created_at" desc
                    limit $limit) as "UserOrders"
         `,
      );
   });

   test("subquery with params", () => {
      const UserOrders = sql<IOrdersSelect, { limit: 5 }>`
         ${info({ label: "UserOrders" })}
         select ${Orders.orderId}, ${Orders.status}, ${Orders.total}, ${Orders.createdAt}, ${Orders.updatedAt}
         from ${Orders}
         where ${Orders.userId} = ${Users.userId}
         order by ${Orders.createdAt} desc
         limit ${param("limit")}`;

      const query = sql<IUsersSelect, { city: string; limit: number }>`
         select ${Users.$$all}, ${jsonAgg(UserOrders)} as "orders"
         from ${Users}
                 left join lateral ( ${jsonAgg(UserOrders)})
         on true
         order by ${Users.userId} asc
      `;

      expect(trim(query.sql({ city: "Munich", limit: 5 }))).toBe(
         trim`select "users_1"."user_id"    as "userId",
                     "users_1"."name",
                     "users_1"."email",
                     "users_1"."age",
                     "users_1"."city",
                     "users_1"."password",
                     "users_1"."created_at" as "createdAt",
                     "users_1"."updated_at" as "updatedAt",
                     "UserOrders_result"    as "orders"
              from "public"."users" as "users_1"
                      left join lateral (
                 select coalesce(jsonb_agg("UserOrders".*), '[]') as "UserOrders_result"
                 from (
                         /* --label: UserOrders */
                         select "orders_1"."order_id"   as "orderId",
                                "orders_1"."status",
                                "orders_1"."total",
                                "orders_1"."created_at" as "createdAt",
                                "orders_1"."updated_at" as "updatedAt"
                         from "public"."orders" as "orders_1"
                         where "orders_1"."user_id" = "users_1"."user_id"
                         order by "orders_1"."created_at" desc
                         limit ?) as "UserOrders") on true
              order by "users_1"."user_id" asc`,
      );
   });
});

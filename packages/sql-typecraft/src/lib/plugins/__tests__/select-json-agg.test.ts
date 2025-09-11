import { describe, expect, test } from "vitest";
import { sql } from "../../sql.js";
import { IOrdersSelect, Orders } from "../../__tests__/types/orders-model.js";
import { info } from "../sql-info.js";
import { IUsersSelect, Users } from "../../__tests__/types/index.js";
import { param } from "../../sql-param.js";
import { jsonAgg } from "../select-json-agg.js";
import { trim } from "../../__tests__/utils.js";

describe("sql plugin: jsonAgg()", () => {
   test("subquery with params", () => {
      const UserOrders = sql<IOrdersSelect, { limit: 5 }>`
            ${info({ label: "UserOrders" })}
            select ${Orders.orderId}, ${Orders.status}, ${Orders.total}, ${Orders.createdAt}, ${Orders.updatedAt}
            from ${Orders}
            where ${Orders.userId} = ${Users.userId}
            order by ${Orders.createdAt} desc
            limit ${param("limit")}`;

      const query = sql<IUsersSelect, { city: string; limit: number }>`
         select ${Users.$.all}, ${jsonAgg(UserOrders)} "orders"
         from ${Users}
                 left join lateral ( ${jsonAgg(UserOrders)} )
         order by ${Users.userId} asc
      `;

      expect(trim(query.sql({ city: "Munich", limit: 5 }))).toBe(
         trim`select "users_1"."user_id"    "userId",
                     "users_1"."name",
                     "users_1"."email",
                     "users_1"."age",
                     "users_1"."city",
                     "users_1"."password",
                     "users_1"."created_at" "createdAt",
                     "users_1"."updated_at" "updatedAt",
                     coalesce(
                           jsonb_agg("UserOrders".*) filter (where "UserOrders".* is not null),
                           '[]'
                     )                      "orders"
              from "public"."users" "users_1"
                      left join lateral ( (
                 /* --label: UserOrders */
                 select "orders_1"."order_id"   "orderId",
                        "orders_1"."status",
                        "orders_1"."total",
                        "orders_1"."created_at" "createdAt",
                        "orders_1"."updated_at" "updatedAt"
                 from "public"."orders" "orders_1"
                 where "orders_1"."user_id" = "users_1"."user_id"
                 order by "orders_1"."created_at" desc
                 limit ?) "UserOrders" on true )
              order by "users_1"."user_id" asc`,
      );
   });
});

import { describe, expect, test } from "vitest";
import { sql } from "#/core/sql.js";
import { row } from "#/core/query/sql-select-row.js";
import { Account } from "@test-models/vexnor_dev.account-table.js";
import { param } from "#/core/query/sql-param.js";
import { Order } from "@test-models/vexnor_dev.order-table.js";
import { OrderItem } from "@test-models/vexnor_dev.order_item-table.js";
import { SqlSelectAll } from "#/core/query/sql-select-all.js";
import { Sql } from "#/core/sql-base.js";

describe("SqlQuery.$... tests", () => {
   const query = sql`
         select ${row(Account.$$, Order.$orderId, OrderItem.$productId, OrderItem.$productPrice)}
         from ${Account}
            join ${Order} on ${Order.$accountId} = ${Account.$accountId}
         join ${OrderItem} on ${OrderItem.$orderId} = ${Order.$orderId}
         where ${Account.$accountId} = ${param<{ accountId: string }>("accountId")}
      `;

   test("SqlQuery.$$ should be defined", () => {
      expect(query.$$).toBeDefined();
      expect(query.$$).toBeInstanceOf(SqlSelectAll);
      expect(query.$$).toBeInstanceOf(Sql);
   });

   test("SqlQuery.$[column] should be defined", () => {
      expect(query.$accountId).toBeDefined();
   });
});

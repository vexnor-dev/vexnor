import { describe, expect, test } from "vitest";
import { sql } from "../../sql.js";
import { row } from "../sql-select-row.js";
import { Account } from "@test-models/valnor_test.account-table.js";
import { param } from "../sql-param.js";
import { Order } from "@test-models/valnor_test.order-table.js";
import { OrderItem } from "@test-models/valnor_test.order_item-table.js";
import { SqlSelectAll } from "../sql-select-all.js";
import { Sql } from "../../sql-base.js";

describe("SqlQuery.$... tests", () => {
   const query = sql`
         select ${row(Account.$$, Order.$orderId, OrderItem.$productId, OrderItem.$productPrice)}
         from ${Account}
            join ${Order} on ${Order.$accountId} = ${Account.$accountId}
         join ${OrderItem} on ${OrderItem.$orderId} = ${Order.$orderId}
         where ${Account.$accountId} = ${param("accountId").is<string>()}
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

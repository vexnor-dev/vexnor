import { describe, expect, test } from "vitest";
import { SqlBuildContext } from "../sql-build-context.js";
import { sql } from "../../sql.js";
import { Account } from "@test-models/valnor_test.account-table.js";
import { row } from "../sql-select-row.js";
import { SqlBuildError } from "../../sql-build-error.js";
import { param } from "../sql-param.js";
import { Order } from "@test-models/valnor_test.order-table.js";
import { info } from "../../charms/index.js";
import { OrderItem } from "@test-models/valnor_test.order_item-table.js";

describe("SqlBuildContext getQueryName", () => {
   const orderItemQuery = sql`
    select ${row(OrderItem.$orderId, OrderItem.$createdAt, OrderItem.$productId, OrderItem.$productPrice)}
    from ${Order};
`;

   const orderQuery = sql`
        ${info({ label: "Orders" })}
      select ${row(Order.$$all)}
      from ${Order};
   `;

   const query = sql`
         select ${row(Account.$$all, orderQuery.$orderId, orderItemQuery.$productId, orderItemQuery.$productPrice)}
         from ${Account}
            join ${orderQuery} on ${Account.$accountId} = ${orderQuery.$accountId}
         join ${orderItemQuery} on ${orderQuery.$orderId} = ${orderItemQuery.$orderId}
         where ${Account.$accountId} = ${param("accountId").is<string>()}
      `;

   const context = new SqlBuildContext({
      query,
   });

   test("getQueryName should throw for SqlTable", () => {
      expect(() => context.getQueryName(Account)).toThrowError(SqlBuildError);
   });

   test("getQueryName should throw for included SqlTable.$[column]", () => {
      expect(() => context.getQueryName(Account.$accountId)).toThrowError(SqlBuildError);
   });

   test("getQueryName should throw for not included SqlTable.$[column]", () => {
      expect(() => context.getQueryName(Account.$email)).toThrowError(SqlBuildError);
   });

   test("getQueryName should return value for SqlSelectRow.$all", () => {
      expect(() => context.getQueryName(Account)).toThrowError(SqlBuildError);
      expect(context.getQueryName(query.$$all)).toEqual("query_0");
   });

   test("getQueryName should return value for SqlSelectRow.$[columns]", () => {
      expect(context.getQueryName(query.$accountId)).toEqual("query_0");
   });

   test("SqlBuildContext should return custom query name: Orders", () => {
      expect(context.getQueryName(orderQuery)).toEqual("Orders");
   });

   test("SqlBuildContext should return default query name: query_2", () => {
      expect(context.getQueryName(orderItemQuery)).toEqual("query_2");
   });
});

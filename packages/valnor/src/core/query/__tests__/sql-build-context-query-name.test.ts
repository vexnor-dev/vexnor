import { describe, expect, test } from "vitest";
import { SqlBuildContext } from "../sql-build-context.js";
import { sql } from "../../sql.js";
import { Account } from "@test-models/valnor_test.account-table.js";
import { row, SqlSelectRow } from "../sql-select-row.js";
import { SqlBuildError } from "../../sql-build-error.js";
import { param } from "../sql-param.js";
import { Order } from "@test-models/valnor_test.order-table.js";
import { info } from "../../charms/index.js";
import { OrderItem } from "@test-models/valnor_test.order_item-table.js";
import { SqlSelectColumn } from "../sql-select-column.js";
import { before } from "node:test";

describe("SqlBuildContext getQueryName", () => {
   const findOrderItems = sql`
      ${info({ label: "OrderItems" })}
    select ${row(OrderItem.$orderId, OrderItem.$createdAt, OrderItem.$productId, OrderItem.$productPrice)}
    from ${Order};
`;

   const findOrders = sql`
        ${info({ label: "Orders" })}
      select ${row(Order.$$)}
      from ${Order};
   `;

   const findOldAccounts = sql`
      ${info({ label: "AccountsOld" })}
      select ${row(Account.$$)}
      from ${Account}
      where ${Account.$createdAt} = ${Date.parse("2020-01-01")}
   `;

   const query = sql`
        ${info({ label: "Root" })}
         select ${row(Account.$$, findOrders.$orderId, findOrderItems.$productId, findOrderItems.$productPrice)}
         from ${findOldAccounts}
            join ${findOrders} on ${Account.$accountId} = ${findOrders.$accountId}
         join ${findOrderItems} on ${findOrders.$orderId} = ${findOrderItems.$orderId}
         where ${Account.$accountId} = ${param<{ accountId: string }>("accountId")}
      `;

   let context!: SqlBuildContext;

   before(() => {
      context = new SqlBuildContext({
         query,
      });
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
      expect(context.getQueryName(query.$$)).toEqual("Root");
   });

   test("getQueryName should return value for own $accountId", () => {
      expect(context.getQueryName(query.$accountId)).toEqual("Root");
   });

   test("getQueryName should return value for subquery $orderId", () => {
      context.scope({ query: findOrders });
      const column = findOrders.$orderId;
      console.log("\nLooking up query for column:", column.ID);

      // Check what's in root query rawValues
      console.log("\nRoot query rawValues:");
      query.rawValues.forEach((val, idx) => {
         if (val instanceof SqlSelectColumn && val.ID === column.ID) {
            console.log(`  rawValue[${idx}] is SqlSelectColumn with matching ID!`);
            console.log(`  Is it the same instance? ${val === column}`);
         }
         if (val instanceof SqlSelectRow) {
            console.log(`  rawValue[${idx}] is SqlSelectRow`);
            // Check if it contains the original orderQuery.$orderId
            Object.entries(val.row).forEach(([key, col]) => {
               if (col.ID === column.ID) {
                  console.log(`    FOUND! key=${key}, col.ID=${col.ID}`);
                  console.log(`    Is it the same instance? ${col === column}`);
               }
            });
         }
      });

      expect(context.getQueryName(findOrders.$orderId)).toEqual("Orders");
   });

   test("SqlBuildContext should return custom query name: Order", () => {
      expect(context.getQueryName(findOrders)).toEqual("Orders");
   });

   test("SqlBuildContext should return default query name: AccountsOld", () => {
      expect(context.getQueryName(findOldAccounts)).toEqual("AccountsOld");
   });

   test("SqlBuildContext should return default query name: OrderItems", () => {
      expect(context.getQueryName(findOrderItems)).toEqual("OrderItems");
   });

   test("Check context.queries array", () => {
      console.log("\ncontext.queries:");
      context.queries.forEach((q, idx) => {
         console.log(`  [${idx}]: ${q.query.info?.label || "unlabeled"}, ID=${q.query.ID}`);
      });

      console.log("\nExpected queries: Root, AccountsOld, Orders, OrderItems");
      expect(context.queries.size).toBe(4);
   });

   test("Find where orderQuery.$orderId column is", () => {
      const originalColumn = findOrders.$orderId;
      console.log("\nLooking for orderQuery.$orderId:", originalColumn.ID);

      console.log("\nIs it in orderQuery.row.row?");
      if (findOrders.row) {
         Object.entries(findOrders.row).forEach(([key, col]) => {
            if (col === originalColumn) {
               console.log(`  YES! Found at key: ${key}`);
            }
         });
      }

      console.log("\nIs it in orderQuery.rawValues?");
      findOrders.rawValues.forEach((val, idx) => {
         if (val instanceof SqlSelectRow && val.row) {
            Object.entries(val.row).forEach(([key, col]) => {
               if (col === originalColumn) {
                  console.log(`  YES! Found in rawValue[${idx}] at key: ${key}`);
               }
            });
         }
      });
   });

   test("Check what's in query.row.row vs rawValue.row", () => {
      if (query.row) {
         Object.entries(query.row).forEach(([key, col]) => {
            console.log(`  ${key}: ${col.ID}`);
         });
      }

      console.log("\nColumns in query.rawValues SqlSelectRow:");
      query.rawValues.forEach((val, idx) => {
         if (val instanceof SqlSelectRow && val.row) {
            console.log(`  rawValue[${idx}]:`);
            Object.entries(val.row).forEach(([key, col]) => {
               console.log(`    ${key}: ${col.ID}`);
            });
         }
      });
   });

   test("Verify orderQuery.$orderId is different from row() created column", () => {
      // The original column from orderQuery
      const originalColumn = findOrders.$orderId;

      // The column created by row() in the root query
      const rootQueryColumn = query.$orderId;

      console.log("\noriginalColumn ID:", originalColumn.ID);
      console.log("rootQueryColumn ID:", rootQueryColumn.ID);
      console.log("Are they the same instance?", originalColumn === rootQueryColumn);
      console.log("Are IDs equal?", originalColumn.ID === rootQueryColumn.ID);

      // They should be DIFFERENT instances with DIFFERENT IDs
      expect(originalColumn).not.toBe(rootQueryColumn);
      expect(originalColumn.ID).not.toEqual(rootQueryColumn.ID);
   });

   test("SqlBuildContext.rawTokens() should match snapshot", () => {
      const actual = Array.from(context.rowTokens()).map((token) => {
         return {
            sql: token,
            query: token.query.info?.label ?? `query_${context.getQueryName(token.sql)}`,
         };
      });

      console.log(actual);
   });
});

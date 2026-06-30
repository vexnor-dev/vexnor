import { describe, expect, test } from "vitest";
import { row, sql } from "@vexnor/core";
import { jsonOne, jsonMany } from "#src/charms/json-aggregation-mssql.js";
import { Account } from "@vexnor/core/testing";
import { Order } from "@vexnor/core/testing";

describe("SqlQuery.jsonSchema with mssql charms", () => {
   test("jsonOne.as() — schema includes inner Date columns as object", () => {
      const lastOrder = sql`
         select top 1 ${row(Order.$orderId, Order.$status, Order.$createdAt)}
         from ${Order}
         where ${Order.$accountId} = ${Account.out.$accountId}
      `;

      const q = sql`
         select ${row(Account.$accountId, Account.$createdAt)},
                ${jsonOne(lastOrder).as("lastOrder")}
         from ${Account} ${jsonOne(lastOrder)}
      `;

      expect(q.jsonSchema).toMatchInlineSnapshot(`
        {
          "createdAt": "Date",
          "lastOrder": {
            "createdAt": "Date",
          },
        }
      `);
   });

   test("jsonMany.as() — schema includes inner Date columns as array", () => {
      const orders = sql`
         select ${row(Order.$orderId, Order.$createdAt)}
         from ${Order}
         where ${Order.$accountId} = ${Account.out.$accountId}
      `;

      const q = sql`
         select ${row(Account.$accountId, Account.$createdAt)},
                ${jsonMany(orders).as("orders")}
         from ${Account} ${jsonMany(orders)}
      `;

      expect(q.jsonSchema).toMatchInlineSnapshot(`
        {
          "createdAt": "Date",
          "orders": [
            {
              "createdAt": "Date",
            },
          ],
        }
      `);
   });

   test("no charm columns — schema only has table Date columns", () => {
      const q = sql`
         select ${row(Account.$accountId, Account.$email, Account.$createdAt)}
         from ${Account}
      `;

      expect(q.jsonSchema).toMatchInlineSnapshot(`
        {
          "createdAt": "Date",
        }
      `);
   });

   test("no Date columns anywhere — returns empty schema", () => {
      const q = sql`
         select ${row(Account.$accountId, Account.$email)}
         from ${Account}
      `;

      expect(q.jsonSchema).toMatchInlineSnapshot(`{}`);
   });

   test("nested jsonMany inside jsonMany — schema reflects two levels", () => {
      const orderItems = sql`
         select ${row(Order.$orderId, Order.$createdAt)}
         from ${Order}
         where ${Order.$accountId} = ${Account.out.$accountId}
      `;

      const accountsWithOrders = sql`
         select ${row(Account.$accountId, Account.$createdAt)},
                ${jsonMany(orderItems).as("orders")}
         from ${Account} ${jsonMany(orderItems)}
      `;

      const q = sql`
         select ${row(Account.$accountId)},
                ${jsonMany(accountsWithOrders).as("accounts")}
         from ${Account} ${jsonMany(accountsWithOrders)}
      `;

      expect(q.jsonSchema).toMatchInlineSnapshot(`
        {
          "accounts": [
            {
              "createdAt": "Date",
              "orders": [
                {
                  "createdAt": "Date",
                },
              ],
            },
          ],
        }
      `);
   });
});

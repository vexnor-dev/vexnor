import { beforeAll, describe, expect, test } from "vitest";
import { row } from "@vexnor/core";
import { DuckDBSelectCommand, jsonMany, jsonOne, sql } from "@vexnor/duckdb";
import { Account, type IAccountSelect } from "./codegen/main.account-table.js";
import { Order } from "./codegen/main.order-table.js";
import { db } from "./config.js";
import { insertAccount, insertOrder } from "./fixtures.js";

describe("vexnor DuckDB joins and JSON e2e", { concurrent: false }, () => {
   let parent: IAccountSelect;
   let child: IAccountSelect;

   beforeAll(async () => {
      parent = await insertAccount("relations-parent");
      child = await insertAccount("relations-child", { parentId: parent.accountId });
      await insertOrder(parent.accountId);
      await insertOrder(parent.accountId);
   });

   test("executes a self join with generated aliases", async () => {
      const result = await sql`
         select ${row(Account.$accountId, Account.as("parent").$email.as("parentEmail"))}
         from ${Account}
         join ${Account.as("parent")} on ${Account.as("parent").$accountId} = ${Account.$parentId}
         where ${Account.$accountId} = ${child.accountId}
      `.duckdb.one({ db });

      expect(result.accountId).toBe(child.accountId);
      expect(result.parentEmail).toBe(parent.email);
      expect({ accountMatches: result.accountId === child.accountId, parentMatches: result.parentEmail === parent.email }).toMatchInlineSnapshot(`
        {
          "accountMatches": true,
          "parentMatches": true,
        }
      `);
   });

   test("jsonOne returns a typed correlated object", async () => {
      const parentQuery = sql`
         select ${row(Account.as("parent").$$)} from ${Account.as("parent")}
         where ${Account.as("parent").$accountId} = ${Account.out.$parentId}
      `;
      const result = await sql`
         select ${row(Account.$$)}, ${jsonOne(parentQuery).as("parent")}
         from ${Account} where ${Account.$accountId} = ${child.accountId}
      `.duckdb.one({ db });

      expect(result.parent?.accountId).toBe(parent.accountId);
   });

   test("jsonMany returns typed correlated arrays", async () => {
      const orders = sql`
         select ${row(Order.$$)} from ${Order}
         where ${Order.$accountId} = ${Account.out.$accountId}
         order by ${Order.$orderId}
      `;
      const result = await sql`
         select ${row(Account.$$)}, ${jsonMany(orders).as("orders")}
         from ${Account} where ${Account.$accountId} = ${parent.accountId}
      `.duckdb.one({ db });

      for (const order of result.orders) expect(order.accountId).toBe(parent.accountId);
      expect(result.orders.map(({ status }) => status)).toMatchInlineSnapshot(`
        [
          "created",
          "created",
        ]
      `);
   });

   test("CRUD includeOne and includeMany deserialize native JSON", async () => {
      const children = sql`
         select ${row(Account.as("children").$$)} from ${Account.as("children")}
         where ${Account.as("children").$parentId} = ${Account.out.$accountId}
      `;
      const result = await new DuckDBSelectCommand(Account, {
         WHERE: sql`${Account.$accountId} = ${parent.accountId}`,
         includeMany: { children },
         includeOne: {
            firstOrder: new DuckDBSelectCommand(Order, {
               WHERE: sql`${Order.$accountId} = ${Account.out.$accountId}`,
            }).execute(),
         },
      }).execute().one({ db, params: {} });

      expect(result.children[0]!.accountId).toBe(child.accountId);
      expect(result.firstOrder?.accountId).toBe(parent.accountId);
      expect({ childMatches: result.children[0]!.accountId === child.accountId, orderMatches: result.firstOrder?.accountId === parent.accountId }).toMatchInlineSnapshot(`
        {
          "childMatches": true,
          "orderMatches": true,
        }
      `);
   });
});

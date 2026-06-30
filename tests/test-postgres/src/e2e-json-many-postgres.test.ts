import { beforeAll, describe, expect, test } from "vitest";
import { info, insert, param, row } from "@vexnor/core";
import { Account, AccountStatusUdt, IAccountSelect, Order, IOrderSelect } from "./codegen/vexnor_dev.schema.js";
import { jsonMany, sql } from "@vexnor/postgres";
import { pool } from "./postgres-pool.js";

describe.sequential("jsonMany() tests", () => {
   const TAG = "json-many-test";
   let parentAccount!: IAccountSelect;
   let orders!: IOrderSelect[];

   beforeAll(async () => {
      parentAccount = await sql`
         insert into ${Account}
            ${insert(Account, "rows")}
            returning ${row(Account.$$)}
      `.one({ db: pool, params: { rows: [{
               status: AccountStatusUdt.CREATED,
               firstName: "John-0-json-many",
               lastName: "Doe-0-json-many",
               email: `john.doe-${TAG}@example.com`,
            }] } });
      expect(parentAccount.accountId).toBeDefined();

      const childrenAccounts = await sql`
         insert into ${Account}
            ${insert(Account, "rows")}
            returning ${row(Account.$$)}
      `.all({ db: pool, params: { rows: [
               {
                  status: AccountStatusUdt.CREATED,
                  firstName: "John-1-json-many",
                  lastName: "Doe-1-json-many",
                  email: `john.doe-1-${TAG}@example.com`,
                  parentId: parentAccount.accountId,
               },
               {
                  status: AccountStatusUdt.CREATED,
                  firstName: "John-2-json-many",
                  lastName: "Doe-2-json-many",
                  email: `john.doe-2-${TAG}@example.com`,
                  parentId: parentAccount.accountId,
               },
            ] } });
      expect(childrenAccounts).toHaveLength(2);

      orders = await sql`
         insert into ${Order}
            ${insert(Order, "rows")}
            returning ${row(Order.$$)}
      `.all({ db: pool, params: { rows: [{ accountId: parentAccount.accountId }, { accountId: parentAccount.accountId }] } });
      expect(orders).toHaveLength(2);
   });

   // Used for E2E tests — Account.out resolves to the outer lateral alias
   const AccountOrders = sql`
      ${info({ label: "AccountOrders" })}
      select ${row(Order.$orderId, Order.$status, Order.$createdAt, Order.$modifiedAt)}
      from ${Order}
      where ${Order.$accountId} = ${Account.out.$accountId}
      order by ${Order.$createdAt} desc
      limit ${param<{ limit: number }>("limit")}`;

   test("jsonMany(): select - returns correct column in result", async () => {
      const query = sql`
         select ${row(Account.$$)}, ${jsonMany(AccountOrders).as("orders")}
         from ${Account} ${jsonMany(AccountOrders)}
         where ${Account.$accountId} = ${parentAccount.accountId}
      `;
      const results = await query.all({ db: pool, params: { limit: 10 } });
      expect(results).toHaveLength(1);
      expect(results[0]).toHaveProperty("orders");
   });

   test("jsonMany(): from - lateral join produces aggregated results", async () => {
      const query = sql`
         select ${row(Account.$$)}, ${jsonMany(AccountOrders).as("orders")}
         from ${Account} ${jsonMany(AccountOrders)}
         where ${Account.$accountId} = ${parentAccount.accountId}
      `;
      const results = await query.all({ db: pool, params: { limit: 10 } });
      expect(results).toHaveLength(1);
      expect(results[0]!.orders).toHaveLength(2);
   });

   test("jsonMany() with params", async () => {
      const query = sql`
         select ${row(Account.$$)}, ${jsonMany(AccountOrders).as("orders")}
         from ${Account} ${jsonMany(AccountOrders)}
         where ${Account.$accountId} = ${parentAccount.accountId}
         order by ${Account.$accountId}
      `;
      const results = await query.all({ db: pool, params: { limit: 1 } });
      expect(results).toHaveLength(1);
      expect(results[0]!.orders).toHaveLength(1);
   });

   test("jsonMany() with custom alias", async () => {
      const query = sql`
         select ${row(Account.$$)}, ${jsonMany(AccountOrders).as("myOrders")}
         from ${Account} ${jsonMany(AccountOrders)}
         where ${Account.$accountId} = ${parentAccount.accountId}
         order by ${Account.$accountId}
      `;
      const results = await query.all({ db: pool, params: { limit: 10 } });
      expect(results).toHaveLength(1);
      expect(results[0]).toHaveProperty("myOrders");
      expect(results[0]!.myOrders).toHaveLength(2);
   });

   test("jsonMany() E2E: returns aggregated orders for account", async () => {
      const query = sql`
         select ${row(Account.$$)}, ${jsonMany(AccountOrders).as("orders")}
         from ${Account} ${jsonMany(AccountOrders)}
         where ${Account.$accountId} = ${parentAccount.accountId}
      `;

      const results = await query.all({ db: pool, params: { limit: 10 } });
      expect(results).toHaveLength(1);
      expect(results[0]!.orders).toHaveLength(2);
      expect(results[0]!.orders.map((o) => o.orderId)).toEqual(expect.arrayContaining(orders.map((o) => o.orderId)));
   });

   test("jsonMany() E2E: returns empty array when no orders", async () => {
      const accountWithNoOrders = await sql`
         insert into ${Account}
            ${insert(Account, "rows")}
            returning ${row(Account.$$)}
      `.one({ db: pool, params: { rows: [{
               status: AccountStatusUdt.CREATED,
               firstName: "No-orders",
               lastName: "Account",
               email: `no-orders-${TAG}@example.com`,
            }] } });

      const query = sql`
         select ${row(Account.$$)}, ${jsonMany(AccountOrders).as("orders")}
         from ${Account} ${jsonMany(AccountOrders)}
         where ${Account.$accountId} = ${accountWithNoOrders.accountId}
      `;

      const results = await query.all({ db: pool, params: { limit: 10 } });
      expect(results).toHaveLength(1);
      expect(results[0]!.orders).toEqual([]);
   });
});

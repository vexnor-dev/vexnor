import { beforeAll, describe, expect, test } from "vitest";
import { ok } from "node:assert";
import { randomUUID } from "node:crypto";
import { param, row } from "vexnor";
import { sql, sqlite3Select } from "@vexnor/sqlite3";
import "@vexnor/sqlite3";
import { Account, IAccountInsert, IAccountSelect } from "./codegen/main.account-table.js";
import { Order, IOrderInsert, IOrderSelect } from "./codegen/main.order-table.js";
import { db } from "./config.js";

describe.sequential("vexnor sqlite3 CRUD - select", () => {
   let rootAccount!: IAccountSelect;
   let childAccount!: IAccountSelect;
   let order!: IOrderSelect;

   beforeAll(async () => {
      const rootInsert: IAccountInsert = {
         accountId: randomUUID(),
         email: `select-root-${randomUUID()}@example.com`,
         firstName: "Select",
         lastName: "Root",
      };
      rootAccount = await sql`
         insert into ${Account} ${Account.insertColsVals(rootInsert)} returning ${row(Account.$$)}
      `.sqlite.one({ db });

      const childInsert: IAccountInsert = {
         accountId: randomUUID(),
         email: `select-child-${randomUUID()}@example.com`,
         firstName: "Select",
         lastName: "Child",
         parentId: rootAccount.accountId,
      };
      childAccount = await sql`
         insert into ${Account} ${Account.insertColsVals(childInsert)} returning ${row(Account.$$)}
      `.sqlite.one({ db });

      const orderInsert: IOrderInsert = { accountId: rootAccount.accountId };
      order = await sql`
         insert into ${Order} ${Order.insertColsVals(orderInsert)} returning ${row(Order.$$)}
      `.sqlite.one({ db });
   });

   test("select: basic select with WHERE", async () => {
      ok(rootAccount);
      const result = await sqlite3Select(Account, {
         WHERE: sql`${Account.$accountId} = ${param<{ id: string }>("id")}`,
      }).any({ db, params: { id: rootAccount.accountId } });
      expect(result).toEqual(rootAccount);
   });

   test("select: with ORDER_BY + limit + offset", async () => {
      const results = await sqlite3Select(Account, {
         WHERE: sql`${Account.$accountId} in (${[rootAccount.accountId, childAccount.accountId]})`,
         ORDER_BY: sql`${Account.$email} asc`,
         limit: param<{ limit: number }>("limit"),
         offset: param<{ offset: number }>("offset"),
      }).all({ db, params: { limit: 1, offset: 0 } });
      expect(results).toHaveLength(1);
   });

   test("select: includeMany (children)", async () => {
      ok(rootAccount);
      const children = sql`
         select ${row(Account.as("children").$$)}
         from ${Account.as("children")}
         where ${Account.as("children").$parentId} = ${Account.out.$accountId}
      `;

      const results = await sqlite3Select(Account, {
         WHERE: sql`${Account.$accountId} = ${rootAccount.accountId}`,
         includeMany: { children },
      }).all({ db });

      expect(results).toHaveLength(1);
      const parsed = results[0]!.children;
      expect(parsed).toHaveLength(1);
      expect(parsed[0]!.accountId).toBe(childAccount.accountId);
   });

   test("select: includeOne (firstOrder)", async () => {
      ok(rootAccount);
      ok(order);
      const results = await sqlite3Select(Account, {
         WHERE: sql`${Account.$accountId} = ${rootAccount.accountId}`,
         includeOne: {
            firstOrder: sqlite3Select(Order, {
               WHERE: sql`${Order.$accountId} = ${Account.out.$accountId} and ${Order.$orderId} = ${order.orderId}`,
            }),
         },
      }).all({ db });

      expect(results).toHaveLength(1);
      const parsed = results[0]!.firstOrder;
      expect(parsed?.orderId).toBe(order.orderId);
   });

   test("select: includeOne returns null when no match", async () => {
      ok(rootAccount);
      const results = await sqlite3Select(Account, {
         WHERE: sql`${Account.$accountId} = ${rootAccount.accountId}`,
         includeOne: {
            firstOrder: sqlite3Select(Order, {
               WHERE: sql`${Order.$accountId} = ${Account.out.$accountId} and ${Order.$orderId} = ${randomUUID()}`,
            }),
         },
      }).all({ db });

      expect(results).toHaveLength(1);
      expect(results[0]!.firstOrder).toBeNull();
   });

   test("select: includeMany returns empty array when no match", async () => {
      ok(childAccount);
      const children = sql`
         select ${row(Account.as("children").$$)}
         from ${Account.as("children")}
         where ${Account.as("children").$parentId} = ${Account.out.$accountId}
      `;

      const results = await sqlite3Select(Account, {
         WHERE: sql`${Account.$accountId} = ${childAccount.accountId}`,
         includeMany: { children },
      }).all({ db });

      expect(results).toHaveLength(1);
      const parsed = results[0]!.children;
      expect(parsed).toEqual([]);
   });

   test("select: includeOne + includeMany combined", async () => {
      ok(rootAccount);
      ok(order);
      const children = sql`
         select ${row(Account.as("children").$$)}
         from ${Account.as("children")}
         where ${Account.as("children").$parentId} = ${Account.out.$accountId}
      `;

      const results = await sqlite3Select(Account, {
         WHERE: sql`${Account.$accountId} = ${rootAccount.accountId}`,
         includeMany: { children },
         includeOne: {
            firstOrder: sqlite3Select(Order, {
               WHERE: sql`${Order.$accountId} = ${Account.out.$accountId} and ${Order.$orderId} = ${order.orderId}`,
            }),
         },
      }).all({ db });

      expect(results).toHaveLength(1);
      const parsedChildren = results[0]!.children;
      expect(parsedChildren).toHaveLength(1);
      expect(parsedChildren[0]!.accountId).toBe(childAccount.accountId);
      const parsedOrder = results[0]!.firstOrder;
      expect(parsedOrder?.orderId).toBe(order.orderId);
   });

   test("select via Account.sqlite.select", async () => {
      ok(rootAccount);
      const result = await Account.sqlite
         .select({
            WHERE: sql`${Account.$accountId} = ${param<{ id: string }>("id")}`,
         })
         .any({ db, params: { id: rootAccount.accountId } });
      expect(result).toEqual(rootAccount);
   });
});

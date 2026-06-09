// noinspection SqlNoDataSourceInspection,SqlResolve
import { afterAll, beforeAll, describe, expect, test } from "vitest";
import { ok } from "node:assert";
import { HttpRemoteClient, info, param, row } from "vexnor";
import { sql, jsonMany } from "vexnor-sqlite3";
import "vexnor-sqlite3";
import { createTestServer } from "./test-server.js";
import { sqliteDb } from "./config.js";
import {
   Account,
   Order,
   IAccountSelect,
   IOrderSelect,
} from "./codegen/sqlite3/main.schema.js";

const AccountOrders = sql`
   ${info({ label: "AccountOrders" })}
   select ${row(Order.$orderId, Order.$status, Order.$createdAt)}
   from ${Order}
   where ${Order.$accountId} = ${Account.out.$accountId}
   order by ${Order.$createdAt} desc
`;

const selectAccount = sql`
   select ${row(Account.$$)}, ${jsonMany(AccountOrders).as("orders")}
   from ${Account}
   where ${Account.$accountId} = ${param<{ accountId: string }>("accountId")}
`;

const insertAccount = Account.sqlite.insertRows();
const deleteAccount = Account.sqlite.delete({
   WHERE: sql`${Account.$accountId} = ${param<{ accountId: string }>("accountId")}`,
});

describe.sequential("sqlite3 — remote execution via HttpRemoteClient", () => {
   let client: HttpRemoteClient;
   let stop: () => Promise<void>;
   let account: IAccountSelect;
   let orders: IOrderSelect[];
   const TAG = `remote-sqlite3-${Date.now()}`;

   beforeAll(async () => {
      ({ client, stop } = await createTestServer({
         sqlite3: { selectAccount, insertAccount, deleteAccount, AccountOrders },
      }));

      const inserted = await insertAccount.all({
         db: sqliteDb,
         params: { rows: [{ email: `${TAG}@example.com`, firstName: "SQLite", lastName: "Remote", status: "created" }] },
      });
      ok(inserted[0]);
      account = inserted[0];

      orders = await sql`
         insert into ${Order}
            ${Order.insertColsVals({ accountId: account.accountId }, { accountId: account.accountId })}
            returning ${row(Order.$$)}
      `.all({ db: sqliteDb });
   });

   afterAll(async () => {
      if (account) {
         await sql`delete from ${Order} where ${Order.$accountId} = ${account.accountId}`.run({ db: sqliteDb });
         await deleteAccount.run({ db: sqliteDb, params: { accountId: account.accountId } });
      }
      await stop();
   });

   test("all() returns rows", async () => {
      const results = await selectAccount.sqlite.all({ db: client, params: { accountId: account.accountId } });
      expect(results).toHaveLength(1);
      expect(results[0]!.accountId).toBe(account.accountId);
      expect(results[0]!.email).toBe(account.email);
   });

   test("createdAt is returned as a string (SQLite stores dates as text)", async () => {
      const results = await selectAccount.sqlite.all({ db: client, params: { accountId: account.accountId } });
      expect(typeof results[0]!.createdAt).toBe("string");
   });

   test("nested jsonMany orders are returned", async () => {
      const results = await selectAccount.sqlite.all({ db: client, params: { accountId: account.accountId } });
      expect(results[0]!.orders).toHaveLength(orders.length);
      for (const order of results[0]!.orders) {
         expect(typeof order.createdAt).toBe("string");
      }
   });

   test("one() returns single row", async () => {
      const result = await selectAccount.sqlite.one({ db: client, params: { accountId: account.accountId } });
      expect(result.accountId).toBe(account.accountId);
   });

   test("any() returns undefined for unknown id", async () => {
      const result = await selectAccount.sqlite.any({ db: client, params: { accountId: crypto.randomUUID() } });
      expect(result).toBeUndefined();
   });

   test("unregistered query is rejected", async () => {
      const unregistered = sql`select 1`;
      await expect(unregistered.sqlite.all({ db: client })).rejects.toThrow();
   });

   test("write op run() returns changes", async () => {
      const tempInserted = await insertAccount.all({
         db: sqliteDb,
         params: { rows: [{ email: `${TAG}-tmp@example.com`, firstName: "Tmp", lastName: "Tmp", status: "created" }] },
      });
      ok(tempInserted[0]);
      const result = await deleteAccount.run({ db: client, params: { accountId: tempInserted[0].accountId } });
      expect(result.changes).toBe(1);
   });
});

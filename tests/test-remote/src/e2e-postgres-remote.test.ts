// noinspection SqlNoDataSourceInspection,SqlResolve
import { afterAll, beforeAll, describe, expect, test } from "vitest";
import { ok } from "node:assert";
import { HttpRemoteClient, info, insert, param, row } from "@vexnor/core";
import { sql, jsonMany } from "@vexnor/postgres";
import "@vexnor/postgres";
import { createTestServer } from "./test-server.js";
import { pgPool } from "./config.js";
import {
   Account,
   Order,
   IAccountSelect,
   IOrderSelect,
} from "./codegen/postgres/vexnor_dev.schema.js";

const AccountOrders = sql`
   ${info({ label: "AccountOrders" })}
   select ${row(Order.$orderId, Order.$status, Order.$createdAt)}
   from ${Order}
   where ${Order.$accountId} = ${Account.out.$accountId}
   order by ${Order.$createdAt} desc
`;

const selectAccount = sql`
   select ${row(Account.$$)}, ${jsonMany(AccountOrders).as("orders")}
   from ${Account} ${jsonMany(AccountOrders)}
   where ${Account.$accountId} = ${param<{ accountId: string }>("accountId")}
`;

const insertAccount = Account.postgres.insertRows();
const deleteAccount = Account.postgres.delete({
   WHERE: sql`${Account.$accountId} = ${param<{ accountId: string }>("accountId")}`,
});

describe.sequential("postgres — remote execution via HttpRemoteClient", () => {
   let client: HttpRemoteClient;
   let stop: () => Promise<void>;
   let account: IAccountSelect;
   let orders: IOrderSelect[];
   const TAG = `remote-pg-${Date.now()}`;

   beforeAll(async () => {
      ({ client, stop } = await createTestServer({
         postgres: { selectAccount, insertAccount, deleteAccount, AccountOrders },
      }));

      const inserted = await insertAccount.all({
         db: pgPool,
         params: { rows: [{ email: `${TAG}@example.com`, firstName: "PG", lastName: "Remote" }] },
      });
      ok(inserted[0]);
      account = inserted[0];

      orders = await sql`
         insert into ${Order}
            ${insert(Order, 'rows')}
            returning ${row(Order.$$)}
      `.all({ db: pgPool, params: { rows: [{ accountId: account.accountId }, { accountId: account.accountId }] } });
   });

   afterAll(async () => {
      if (account) {
         await sql`delete from ${Order} where ${Order.$accountId} = ${account.accountId}`.run({ db: pgPool });
         await deleteAccount.run({ db: pgPool, params: { accountId: account.accountId } });
      }
      await stop();
   });

   test("all() returns rows", async () => {
      const results = await selectAccount.postgres.all({ db: client, params: { accountId: account.accountId } });
      expect(results).toHaveLength(1);
      expect(results[0]!.accountId).toBe(account.accountId);
      expect(results[0]!.email).toBe(account.email);
   });

   test("top-level Date fields are deserialized", async () => {
      const results = await selectAccount.postgres.all({ db: client, params: { accountId: account.accountId } });
      expect(results[0]!.createdAt).toBeInstanceOf(Date);
      expect(results[0]!.modifiedAt).toBeInstanceOf(Date);
   });

   test("nested jsonMany orders are returned with deserialized Dates", async () => {
      const results = await selectAccount.postgres.all({ db: client, params: { accountId: account.accountId } });
      expect(results[0]!.orders).toHaveLength(orders.length);
      for (const order of results[0]!.orders) {
         expect(order.createdAt).toBeInstanceOf(Date);
      }
   });

   test("one() returns single row", async () => {
      const result = await selectAccount.postgres.one({ db: client, params: { accountId: account.accountId } });
      expect(result.accountId).toBe(account.accountId);
   });

   test("any() returns undefined for unknown id", async () => {
      const result = await selectAccount.postgres.any({ db: client, params: { accountId: crypto.randomUUID() } });
      expect(result).toBeUndefined();
   });

   test("unregistered query is rejected", async () => {
      const unregistered = sql`select 1`;
      await expect(unregistered.postgres.all({ db: client })).rejects.toThrow();
   });

   test("write op run() returns rowCount", async () => {
      const inserted = await insertAccount.all({
         db: pgPool,
         params: { rows: [{ email: `${TAG}-tmp@example.com`, firstName: "Tmp", lastName: "Tmp" }] },
      });
      ok(inserted[0]);
      const result = await deleteAccount.run({ db: client, params: { accountId: inserted[0].accountId } });
      expect(result.rowCount).toBe(1);
   });
});

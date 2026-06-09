// noinspection SqlNoDataSourceInspection,SqlResolve
import { beforeAll, describe, expect, test } from "vitest";
import { info, param, row, type RemoteClient } from "vexnor";
import { SqlQueryRegistry } from "vexnor/execution";
import { Account, IAccountSelect, IOrderSelect, Order } from "./codegen/vexnor_dev.schema.js";
import { jsonMany, sql } from "vexnor-mssql";
import vexnorMssql from "vexnor-mssql";
import { pool } from "./mssql-pool.js";
import { getTag } from "./tags.js";

const AccountOrders = sql`
   ${info({ label: "AccountOrders" })}
   select ${row(Order.$orderId, Order.$status, Order.$createdAt, Order.$modifiedAt)}
   from ${Order}
   where ${Order.$accountId} = ${Account.out.$accountId}
   order by ${Order.$createdAt} desc
   offset 0 rows fetch next ${param<{ limit: number }>("limit")} rows only`;

const selectAccountsWithOrders = sql`
   select ${row(Account.$$)}, ${jsonMany(AccountOrders).as("orders")}
   from ${Account} ${jsonMany(AccountOrders)}
   where ${Account.$accountId} = ${param<{ accountId: string }>("accountId")}
`;

const deleteAccount = Account.mssql.delete({
   WHERE: sql`${Account.$accountId} = ${param<{ accountId: string }>("accountId")}`,
});

describe.sequential("mssql remote execution", (ctx) => {
   const TAG = getTag(ctx);
   let remoteClient: RemoteClient;
   let account!: IAccountSelect;
   let orders!: IOrderSelect[];

   beforeAll(async () => {
      await pool.connect();

      const registry = new SqlQueryRegistry();
      await registry.register(vexnorMssql, {
         selectAccountsWithOrders,
         deleteAccount,
         AccountOrders,
      });

      remoteClient = {
         remoteExecute: (config) =>
            registry.execute({ ...config, params: config.params ?? {} }, async () => pool.request()),
      };

      account = await sql`
         insert into ${Account}
            ${Account.insertCols({ status: "CREATED", firstName: "Remote-Test", lastName: "User", email: `remote-test-${TAG}@example.com` })}
            output ${row(Account.as("inserted").$$)}
            ${Account.insertVals({ status: "CREATED", firstName: "Remote-Test", lastName: "User", email: `remote-test-${TAG}@example.com` })}
      `.mssql.one({ db: pool.request() });

      const orderInserts = [{ accountId: account.accountId }, { accountId: account.accountId }];
      orders = await sql`
         insert into ${Order}
            ${Order.insertCols(...orderInserts)}
            output ${row(Order.as("inserted").$$)}
            ${Order.insertVals(...orderInserts)}
      `.mssql.all({ db: pool.request() });
   });

   test("all() via remote returns rows", async () => {
      const results = await selectAccountsWithOrders.mssql.all({
         db: remoteClient,
         params: { accountId: account.accountId, limit: 10 },
      });
      expect(results).toHaveLength(1);
      expect(results[0]!.accountId).toBe(account.accountId);
      expect(results[0]!.email).toBe(account.email);
   });

   test("all() via remote returns nested orders", async () => {
      const results = await selectAccountsWithOrders.mssql.all({
         db: remoteClient,
         params: { accountId: account.accountId, limit: 10 },
      });
      expect(results[0]!.orders).toHaveLength(2);
      expect(results[0]!.orders.map((o) => o.orderId)).toEqual(expect.arrayContaining(orders.map((o) => o.orderId)));
   });

   test("all() via remote deserializes top-level Date fields", async () => {
      const results = await selectAccountsWithOrders.mssql.all({
         db: remoteClient,
         params: { accountId: account.accountId, limit: 10 },
      });
      expect(results[0]!.createdAt).toBeInstanceOf(Date);
      expect(results[0]!.modifiedAt).toBeInstanceOf(Date);
   });

   test("all() via remote deserializes nested Date fields inside jsonMany", async () => {
      const results = await selectAccountsWithOrders.mssql.all({
         db: remoteClient,
         params: { accountId: account.accountId, limit: 10 },
      });
      for (const order of results[0]!.orders) {
         expect(order.createdAt).toBeInstanceOf(Date);
         expect(order.modifiedAt).toBeInstanceOf(Date);
      }
   });

   test("params are forwarded — limit is respected via remote", async () => {
      const results = await selectAccountsWithOrders.mssql.all({
         db: remoteClient,
         params: { accountId: account.accountId, limit: 1 },
      });
      expect(results[0]!.orders).toHaveLength(1);
   });

   test("run() via remote returns IResult for write op", async () => {
      const tempAccount = await sql`
         insert into ${Account}
            ${Account.insertCols({ email: `remote-run-${TAG}@example.com`, firstName: "Tmp", lastName: "Tmp" })}
            output ${row(Account.as("inserted").$$)}
            ${Account.insertVals({ email: `remote-run-${TAG}@example.com`, firstName: "Tmp", lastName: "Tmp" })}
      `.mssql.one({ db: pool.request() });

      const result = await deleteAccount.run({
         db: remoteClient,
         params: { accountId: tempAccount.accountId },
      });
      expect(result.rowsAffected[0]).toBe(1);
   });

   test("one() via remote returns single row", async () => {
      const result = await selectAccountsWithOrders.mssql.one({
         db: remoteClient,
         params: { accountId: account.accountId, limit: 10 },
      });
      expect(result.accountId).toBe(account.accountId);
   });

   test("any() via remote returns undefined when no rows", async () => {
      const result = await selectAccountsWithOrders.mssql.any({
         db: remoteClient,
         params: { accountId: crypto.randomUUID(), limit: 10 },
      });
      expect(result).toBeUndefined();
   });
});

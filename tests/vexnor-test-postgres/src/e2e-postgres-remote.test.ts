import { beforeAll, describe, expect, test } from "vitest";
import { info, param, row, type RemoteClient } from "vexnor";
import { SqlQueryRegistry } from "vexnor/execution";
import { Account, AccountStatusUdt, IAccountSelect, IOrderSelect, Order } from "./codegen/vexnor_dev.schema.js";
import { jsonMany, sql } from "vexnor-postgres";
import vexnorPostgres from "vexnor-postgres";
import { pool } from "./postgres-pool.js";

const AccountOrders = sql`
   ${info({ label: "AccountOrders" })}
   select ${row(Order.$orderId, Order.$status, Order.$createdAt, Order.$modifiedAt)}
   from ${Order}
   where ${Order.$accountId} = ${Account.out.$accountId}
   order by ${Order.$createdAt} desc
   limit ${param<{ limit: number }>("limit")}`;

const selectAccountsWithOrders = sql`
   select ${row(Account.$$)}, ${jsonMany(AccountOrders).as("orders")}
   from ${Account} ${jsonMany(AccountOrders)}
   where ${Account.$accountId} = ${param<{ accountId: string }>("accountId")}
`;

const insertAccount = Account.postgres.insertRows();
const deleteAccount = Account.postgres.delete({
   WHERE: sql`${Account.$accountId} = ${param<{ accountId: string }>("accountId")}`,
});

describe.sequential("postgres remote execution", () => {
   const TAG = "e2e-remote-postgres";
   let remoteClient: RemoteClient;
   let account!: IAccountSelect;
   let orders!: IOrderSelect[];

   beforeAll(async () => {
      const registry = new SqlQueryRegistry();
      await registry.register(vexnorPostgres, {
         selectAccountsWithOrders,
         insertAccount,
         deleteAccount,
         AccountOrders,
      });

      remoteClient = {
         remoteExecute: (config) => registry.execute({ ...config, params: config.params ?? {} }, async () => pool),
      };

      account = await sql`
         insert into ${Account}
            ${Account.insertColsVals({
               status: AccountStatusUdt.CREATED,
               firstName: "Remote-Test",
               lastName: "User",
               email: `remote-test-${TAG}@example.com`,
            })}
            returning ${row(Account.$$)}
      `.one({ db: pool });

      orders = await sql`
         insert into ${Order}
            ${Order.insertColsVals({ accountId: account.accountId }, { accountId: account.accountId })}
            returning ${row(Order.$$)}
      `.all({ db: pool });
   });

   test("all() via remote returns rows", async () => {
      const results = await selectAccountsWithOrders.postgres.all({
         db: remoteClient,
         params: { accountId: account.accountId, limit: 10 },
      });
      expect(results).toHaveLength(1);
      expect(results[0]!.accountId).toBe(account.accountId);
      expect(results[0]!.email).toBe(account.email);
   });

   test("all() via remote returns nested orders", async () => {
      const results = await selectAccountsWithOrders.postgres.all({
         db: remoteClient,
         params: { accountId: account.accountId, limit: 10 },
      });
      expect(results[0]!.orders).toHaveLength(2);
      expect(results[0]!.orders.map((o) => o.orderId)).toEqual(expect.arrayContaining(orders.map((o) => o.orderId)));
   });

   test("all() via remote deserializes top-level Date fields", async () => {
      const results = await selectAccountsWithOrders.postgres.all({
         db: remoteClient,
         params: { accountId: account.accountId, limit: 10 },
      });
      expect(results[0]!.createdAt).toBeInstanceOf(Date);
      expect(results[0]!.modifiedAt).toBeInstanceOf(Date);
   });

   test("all() via remote deserializes nested Date fields inside jsonMany", async () => {
      const results = await selectAccountsWithOrders.postgres.all({
         db: remoteClient,
         params: { accountId: account.accountId, limit: 10 },
      });
      for (const order of results[0]!.orders) {
         expect(order.createdAt).toBeInstanceOf(Date);
         expect(order.modifiedAt).toBeInstanceOf(Date);
      }
   });

   test("params are forwarded — limit is respected via remote", async () => {
      const results = await selectAccountsWithOrders.postgres.all({
         db: remoteClient,
         params: { accountId: account.accountId, limit: 1 },
      });
      expect(results[0]!.orders).toHaveLength(1);
   });

   test("run() via remote returns QueryResult for write op", async () => {
      const tempAccount = await sql`
         insert into ${Account}
            ${Account.insertColsVals({ email: `remote-run-${TAG}@example.com`, firstName: "Tmp", lastName: "Tmp" })}
            returning ${row(Account.$$)}
      `.one({ db: pool });

      const result = await deleteAccount.postgres.run({
         db: remoteClient,
         params: { accountId: tempAccount.accountId },
      });
      expect(result.rowCount).toBe(1);
   });

   test("one() via remote returns single row", async () => {
      const result = await selectAccountsWithOrders.postgres.one({
         db: remoteClient,
         params: { accountId: account.accountId, limit: 10 },
      });
      expect(result.accountId).toBe(account.accountId);
   });

   test("any() via remote returns undefined when no rows", async () => {
      const result = await selectAccountsWithOrders.postgres.any({
         db: remoteClient,
         params: { accountId: crypto.randomUUID(), limit: 10 },
      });
      expect(result).toBeUndefined();
   });
});

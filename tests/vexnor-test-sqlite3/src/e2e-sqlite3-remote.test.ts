import { beforeAll, describe, expect, test } from "vitest";
import { info, param, row, type RemoteClient } from "vexnor";
import { QueryRegistry } from "vexnor/registry";
import { Account, IAccountSelect, IOrderSelect, Order } from "./codegen/main.schema.js";
import { jsonMany, sql } from "vexnor-sqlite3";
import vexnorSqlite3 from "vexnor-sqlite3";
import { db } from "./config.js";

const AccountOrders = sql`
   ${info({ label: "AccountOrders" })}
   select ${row(Order.$orderId, Order.$status, Order.$createdAt, Order.$modifiedAt)}
   from ${Order}
   where ${Order.$accountId} = ${Account.out.$accountId}
   order by ${Order.$createdAt} desc
   limit ${param<{ limit: number }>("limit")}`;

const selectAccountsWithOrders = sql`
   select ${row(Account.$$)}, ${jsonMany(AccountOrders).as("orders")}
   from ${Account}
   where ${Account.$accountId} = ${param<{ accountId: string }>("accountId")}
`;

const deleteAccountRaw = sql`
   delete from ${Account}
   where ${Account.$accountId} = ${param<{ accountId: string }>("accountId")}
`;

describe.sequential("sqlite3 remote execution", () => {
   let remoteClient: RemoteClient;
   let account!: IAccountSelect;
   let orders!: IOrderSelect[];

   beforeAll(async () => {
      const registry = new QueryRegistry();
      await registry.register(vexnorSqlite3, {
         selectAccountsWithOrders,
         deleteAccountRaw,
         AccountOrders,
      });

      remoteClient = {
         remoteExecute: ({ plugin, hash, params, mode }) => registry.execute(plugin, hash, params ?? {}, async () => db, undefined, mode),
      };

      account = await sql`
         insert into ${Account}
            ${Account.insertColsVals({ status: "created", firstName: "Remote-Test", lastName: "User", email: `remote-test-sqlite3@example.com` })}
            returning ${row(Account.$$)}
      `.sqlite.one({ db });

      orders = await sql`
         insert into ${Order}
            ${Order.insertColsVals({ accountId: account.accountId }, { accountId: account.accountId })}
            returning ${row(Order.$$)}
      `.sqlite.all({ db });
   });

   test("all() via remote returns rows", async () => {
      const results = await selectAccountsWithOrders.sqlite.all({
         db: remoteClient,
         params: { accountId: account.accountId, limit: 10 },
      });
      expect(results).toHaveLength(1);
      expect(results[0]!.accountId).toBe(account.accountId);
      expect(results[0]!.email).toBe(account.email);
   });

   test("all() via remote returns nested orders", async () => {
      const results = await selectAccountsWithOrders.sqlite.all({
         db: remoteClient,
         params: { accountId: account.accountId, limit: 10 },
      });
      expect(results[0]!.orders).toHaveLength(2);
      expect(results[0]!.orders.map((o) => o.orderId)).toEqual(expect.arrayContaining(orders.map((o) => o.orderId)));
   });

   test("params are forwarded — limit is respected via remote", async () => {
      const results = await selectAccountsWithOrders.sqlite.all({
         db: remoteClient,
         params: { accountId: account.accountId, limit: 1 },
      });
      expect(results[0]!.orders).toHaveLength(1);
   });

   test("run() via remote returns RunResult with changes for write op", async () => {
      const tempAccount = await sql`
         insert into ${Account}
            ${Account.insertColsVals({ email: "remote-run-sqlite3@example.com", firstName: "Tmp", lastName: "Tmp" })}
            returning ${row(Account.$$)}
      `.sqlite.one({ db });

      const result = await deleteAccountRaw.sqlite.run({
         db: remoteClient,
         params: { accountId: tempAccount.accountId },
      });
      expect(result.changes).toBe(1);
   });

   test("one() via remote returns single row", async () => {
      const result = await selectAccountsWithOrders.sqlite.one({
         db: remoteClient,
         params: { accountId: account.accountId, limit: 10 },
      });
      expect(result.accountId).toBe(account.accountId);
   });

   test("any() via remote returns undefined when no rows", async () => {
      const result = await selectAccountsWithOrders.sqlite.any({
         db: remoteClient,
         params: { accountId: crypto.randomUUID(), limit: 10 },
      });
      expect(result).toBeUndefined();
   });
});

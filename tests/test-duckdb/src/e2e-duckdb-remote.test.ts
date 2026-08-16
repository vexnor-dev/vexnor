import { beforeAll, describe, expect, test } from "vitest";
import { info, param, row, type RemoteClient } from "@vexnor/core";
import { SqlQueryRegistry } from "@vexnor/core/execution";
import vexnorDuckDB, { jsonMany, sql } from "@vexnor/duckdb";
import { Account, type IAccountSelect } from "./codegen/main.account-table.js";
import { Order } from "./codegen/main.order-table.js";
import { db } from "./config.js";
import { insertAccount, insertOrder } from "./fixtures.js";

const accountOrders = sql`
   ${info({ label: "DuckDBAccountOrders" })}
   select ${row(Order.$$)} from ${Order}
   where ${Order.$accountId} = ${Account.out.$accountId}
     and ${Order.$status} = ${param<{ status: string }>("status")}
   order by ${Order.$orderId}
`;
const selectAccount = sql`
   select ${row(Account.$$)}, ${jsonMany(accountOrders).as("orders")}
   from ${Account}
   where ${Account.$accountId} = ${param<{ accountId: string }>("accountId")}
`;
const updateNotes = sql`
   update ${Account} set ${Account.$notes} = ${param<{ notes: string }>("notes")}
   where ${Account.$accountId} = ${param<{ accountId: string }>("accountId")}
   returning ${row(Account.$accountId, Account.$notes)}
`;

describe("DuckDB remote execution e2e", { concurrent: false }, () => {
   let client: RemoteClient;
   let account: IAccountSelect;
   let writableAccount: IAccountSelect;

   beforeAll(async () => {
      const registry = new SqlQueryRegistry();
      await registry.register(vexnorDuckDB, { accountOrders, selectAccount, updateNotes });
      client = {
         remoteExecute: (config) => registry.execute(
            { ...config, params: config.params ?? {}, mode: config.mode ?? "read" },
            async () => db,
         ),
      };
      account = await insertAccount("remote");
      writableAccount = await insertAccount("remote-write");
      await insertOrder(account.accountId);
      await insertOrder(account.accountId);
   });

   test("executes registered reads through a RemoteClient", async () => {
      const result = await selectAccount.duckdb.one({ db: client, params: { accountId: account.accountId, status: "created" } });

      expect(result.accountId).toBe(account.accountId);
      expect({ accountMatches: result.accountId === account.accountId, orderCount: result.orders.length }).toMatchInlineSnapshot(`
        {
          "accountMatches": true,
          "orderCount": 2,
        }
      `);
   });

   test("forwards nested-query parameters remotely", async () => {
      const result = await selectAccount.duckdb.one({ db: client, params: { accountId: account.accountId, status: "paid" } });

      expect(result.orders).toHaveLength(0);
   });

   test("executes and deserializes registered writes remotely", async () => {
      const result = await updateNotes.duckdb.one({
         db: client,
         params: { accountId: writableAccount.accountId, notes: "remote update" },
      });

      expect(result.accountId).toBe(writableAccount.accountId);
      expect(result.notes).toMatchInlineSnapshot(`"remote update"`);
   });

   test("preserves optional-row semantics remotely", async () => {
      const result = await selectAccount.duckdb.any({
         db: client,
         params: { accountId: crypto.randomUUID(), status: "created" },
      });

      expect(result).toBeUndefined();
   });
});

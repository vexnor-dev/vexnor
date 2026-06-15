// noinspection SqlNoDataSourceInspection,SqlResolve
import { afterAll, beforeAll, describe, expect, test } from "vitest";
import { ok } from "node:assert";
import { HttpRemoteClient, param, row } from "vexnor";
import { sql } from "@vexnor/mssql";
import "@vexnor/mssql";
import { createTestServer } from "./test-server.js";
import { mssqlPool } from "./config.js";
import {
   Account,
   IAccountSelect,
} from "./codegen/mssql/vexnor_dev.schema.js";

const selectAccount = sql`
   select ${row(Account.$accountId, Account.$email, Account.$createdAt, Account.$modifiedAt)}
   from ${Account}
   where ${Account.$accountId} = ${param<{ accountId: string }>("accountId")}
`;

const insertAccount = Account.mssql.insertRows();
const deleteAccount = Account.mssql.delete({
   WHERE: sql`${Account.$accountId} = ${param<{ accountId: string }>("accountId")}`,
});

describe.sequential("mssql — remote execution via HttpRemoteClient", () => {
   let client: HttpRemoteClient;
   let stop: () => Promise<void>;
   let account: IAccountSelect;
   const TAG = `remote-mssql-${Date.now()}`;

   beforeAll(async () => {
      ({ client, stop } = await createTestServer({
         mssql: { selectAccount, insertAccount, deleteAccount },
      }));

      const inserted = await insertAccount.all({
         db: mssqlPool.request(),
         params: { rows: [{ email: `${TAG}@example.com`, firstName: "MSSQL", lastName: "Remote" }] },
      });
      ok(inserted[0]);
      account = inserted[0];
   });

   afterAll(async () => {
      if (account) await deleteAccount.run({ db: mssqlPool.request(), params: { accountId: account.accountId } });
      await stop();
   });

   test("all() returns rows", async () => {
      const results = await selectAccount.mssql.all({ db: client, params: { accountId: account.accountId } });
      expect(results).toHaveLength(1);
      expect(results[0]!.accountId.toLowerCase()).toBe(account.accountId.toLowerCase());
      expect(results[0]!.email).toBe(account.email);
   });

   test("top-level Date fields are deserialized", async () => {
      const results = await selectAccount.mssql.all({ db: client, params: { accountId: account.accountId } });
      expect(results[0]!.createdAt).toBeInstanceOf(Date);
      expect(results[0]!.modifiedAt).toBeInstanceOf(Date);
   });

   test("one() returns single row", async () => {
      const result = await selectAccount.mssql.one({ db: client, params: { accountId: account.accountId } });
      expect(result.accountId.toLowerCase()).toBe(account.accountId.toLowerCase());
   });

   test("any() returns undefined for unknown id", async () => {
      const result = await selectAccount.mssql.any({ db: client, params: { accountId: crypto.randomUUID() } });
      expect(result).toBeUndefined();
   });

   test("unregistered query is rejected", async () => {
      const unregistered = sql`select 1`;
      await expect(unregistered.mssql.all({ db: client })).rejects.toThrow();
   });

   test("write op run() returns rowsAffected", async () => {
      const tempInserted = await insertAccount.all({
         db: mssqlPool.request(),
         params: { rows: [{ email: `${TAG}-tmp@example.com`, firstName: "Tmp", lastName: "Tmp" }] },
      });
      ok(tempInserted[0]);
      const result = await deleteAccount.run({ db: client, params: { accountId: tempInserted[0].accountId } });
      expect(result.rowsAffected[0]).toBe(1);
   });
});

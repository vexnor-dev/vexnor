import { beforeAll, describe, expect, test } from "vitest";
import { ok } from "node:assert";
import { randomUUID } from "node:crypto";
import "valnor-sqlite3";
import { Account, IAccountInsert, IAccountSelect } from "./codegen/main.account-table.js";
import { db } from "./config.js";

describe.sequential("valnor sqlite3 CRUD - find", () => {
   let account!: IAccountSelect;

   beforeAll(async () => {
      const insert: IAccountInsert = {
         accountId: randomUUID(),
         email: `find-test-${randomUUID()}@example.com`,
         firstName: "Find",
         lastName: "Test",
      };
      account = await Account.sqlite3.insertRows().one({ db, params: { rows: [insert] } });
      ok(account, "account not inserted");
   });

   test("findById: fetch account by PK", async () => {
      const result = await Account.sqlite3.findById().any({ db, params: { accountId: account.accountId } });
      expect(result?.accountId).toBe(account.accountId);
      expect(result?.email).toBe(account.email);
   });

   test("findBy: fetch account by email", async () => {
      const result = await Account.sqlite3.findBy().any({ db, params: { email: account.email } });
      expect(result?.accountId).toBe(account.accountId);
   });

   test("findBy: fetch account by multiple fields", async () => {
      const result = await Account.sqlite3
         .findBy()
         .any({ db, params: { email: account.email, lastName: account.lastName } });
      expect(result?.accountId).toBe(account.accountId);
   });
});

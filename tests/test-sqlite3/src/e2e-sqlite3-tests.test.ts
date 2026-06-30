import { beforeAll, describe, expect, test } from "vitest";
import { ok } from "node:assert";
import { param, row, sql } from "@vexnor/core";
import { jsonMany } from "@vexnor/sqlite3";
import { Account, IAccountSelect } from "./codegen/main.account-table.js";
import { db } from "./config.js";
import { TestDataManager } from "./test-data-manager.js";

describe.sequential("vexnor sqlite3 e2e tests", async (ctx) => {
   const dataManager = new TestDataManager(ctx);

   const findAccountById = sql`
      select ${row(Account.$$)}
      from ${Account}
      where ${Account.$accountId} = ${param<{ accountId: string }>("accountId")}
   `;

   beforeAll(async () => {
      await dataManager.initRootAccounts(db);
      await dataManager.initChildAccounts(db);
   });

   test("Check test accounts inserted", () => {
      expect(dataManager.rootAccounts.length).toBe(dataManager.ACCOUNT_ROOT_COUNT);
      expect(dataManager.childAccounts.length).toBe(dataManager.ACCOUNT_ROOT_COUNT * dataManager.ACCOUNT_CHILD_FACTOR);
   });

   test(`Fetch all ${dataManager.ACCOUNT_ROOT_COUNT} root accounts`, async () => {
      const actual = await sql`
         select ${row(Account.$$)}
         from ${Account}
         where ${Account.$accountId} in (${dataManager.rootAccounts.map((z) => z.accountId)})
         order by ${Account.$email}
      `.sqlite.all({ db });
      expect(actual).toEqual(dataManager.rootAccounts);
   });

   test(`Fetch all children accounts`, async () => {
      const actual = await sql`
         select ${row(Account.$$)}
         from ${Account}
         where ${Account.$accountId} in (${dataManager.childAccounts.map((z) => z.accountId)})
         order by ${Account.$email}
      `.sqlite.all({ db });
      expect(actual).toEqual(dataManager.childAccounts);
   });

   test("Fetch account required by id", async () => {
      const expected = dataManager.rootAccounts[0];
      ok(expected);
      const actual = await findAccountById.sqlite.one({
         db,
         params: { accountId: expected.accountId },
      });
      expect(actual).toEqual(expected);
   });

   test("Fetch account optional by id", async () => {
      const actual = await findAccountById.sqlite.any({
         db,
         params: { accountId: crypto.randomUUID() },
      });
      expect(actual).toBeUndefined();
   });

   test("Self join account: fetch accounts with parent info (firstName, lastName, email)", async () => {
      const actual = await sql`
         select ${Account.$$},
                ${Account.as`parent`.$firstName.as(`parentFirstName`)},
                ${Account.as`parent`.$lastName.as(`parentLastName`)},
                ${Account.as`parent`.$email.as(`parentEmail`)}
         from ${Account}
                 join ${Account.as`parent`} on ${Account.as`parent`.$accountId} = ${Account.$parentId}
         where ${Account.$accountId} in (${dataManager.childAccounts.map((z) => z.accountId)})
         order by ${Account.$email}
      `.sqlite.all({ db });
      expect(actual).toBeDefined();
      const expected = dataManager.childAccounts.map((child) => {
         const parent = dataManager.rootAccounts.find((p) => p.accountId === child.parentId);
         ok(parent);
         return {
            ...child,
            parentFirstName: parent.firstName,
            parentLastName: parent.lastName,
            parentEmail: parent.email,
         };
      });
      expect(actual).toEqual(expected);
   });

   test("Fetch root accounts and their children as json array", async () => {
      const accountChildren = sql`
         select ${row(Account.as`children`.$$)}
         from ${Account.as`children`}
         where ${Account.as`children`.$parentId} = ${Account.out.$accountId}
         order by ${Account.as`children`.$accountId}
      `;

      const query = sql`
         select ${row(Account.$$)}, ${jsonMany(accountChildren).as("children")}
         from ${Account}
         where ${Account.$accountId} in (${dataManager.rootAccounts.map((z) => z.accountId)})
         order by ${Account.$email}
      `;

      const actual = await query.sqlite.all({ db });

      const childrenByParentId = new Map<string, IAccountSelect[]>();
      for (const child of dataManager.childAccounts) {
         ok(child.parentId);
         if (!childrenByParentId.has(child.parentId)) childrenByParentId.set(child.parentId, []);
         const arr = childrenByParentId.get(child.parentId)!;
         arr.push(child);
         arr.sort((a, b) => a.accountId.localeCompare(b.accountId));
      }

      const expected = dataManager.rootAccounts.map((account) => ({
         ...account,
         children: childrenByParentId.get(account.accountId),
      }));

      expect(actual).toEqual(expected);
   });

   test("Update account by id", async () => {
      const expected = dataManager.rootAccounts[0];
      ok(expected);
      await sql`
         update ${Account}
         set ${Account.$firstName} = ${expected.firstName + "+test"}
         where ${Account.$accountId} = ${expected.accountId}
      `.sqlite.run({ db });

      const actual = await findAccountById.sqlite.one({
         db,
         params: { accountId: expected.accountId },
      });

      expect(actual).toEqual({ ...expected, firstName: expected.firstName + "+test" });
   });
});

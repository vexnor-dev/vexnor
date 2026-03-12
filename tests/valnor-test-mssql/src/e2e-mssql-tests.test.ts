import { beforeAll, describe, expect, test } from "vitest";
import { randomUUID } from "node:crypto";
import { ok } from "node:assert";
import { param, row, sql } from "valnor";
import { jsonMany } from "valnor-mssql";
import { Account, IAccountJson, IAccountSelect } from "./codegen/valnor_test.schema.js";
import { pool } from "./mssql-pool.js";
import { TestDataManager } from "./test-data-manager.js";

describe.sequential("valnor mssql e2e tests", async (ctx) => {
   const dataManager = new TestDataManager(ctx);

   beforeAll(async () => {
      await dataManager.initRootAccounts(pool);
      await dataManager.initChildAccounts(pool);
   });

   const findAccountById = sql`
      select ${row(Account.$$)}
      from ${Account}
      where ${Account.$accountId} = ${param<{ accountId: string }>("accountId")}
   `;

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
      `.mssql.getAll({ db: pool.request() });

      expect(actual).toEqual(dataManager.rootAccounts);
   });

   test(`Fetch all ${dataManager.ACCOUNT_ROOT_COUNT * dataManager.ACCOUNT_CHILD_FACTOR} children accounts`, async () => {
      const actual = await sql`
    select ${Account.$$}
    from ${Account}
    where ${Account.$accountId} in (${dataManager.childAccounts.map((z) => z.accountId)})
    order by ${Account.$email} asc
`.mssql.getAll({ db: pool.request() });
      expect(actual).toEqual(dataManager.childAccounts);
   });

   test("Fetch account required by id", async () => {
      const expected = dataManager.rootAccounts[0];
      ok(expected);
      const actual = await findAccountById.mssql.getOneRequired({
         db: pool.request(),
         params: { accountId: expected.accountId },
      });
      expect(actual).toEqual(expected);
   });

   test("Fetch account optional by id", async () => {
      const actual = await findAccountById.mssql.getOneOptional({
         db: pool.request(),
         params: { accountId: randomUUID() },
      });
      expect(actual).toBeUndefined();
   });

   test("Self join account: fetch accounts with parent info (firstName, lastName, email)", async () => {
      const actual = await sql`
         select ${row(Account.$$, Account.as(`parent`).$firstName.as(`parentFirstName`), Account.as(`parent`).$lastName.as(`parentLastName`), Account.as(`parent`).$email.as(`parentEmail`))}
         from ${Account}
                 join ${Account.as(`parent`)} on ${Account.as(`parent`).$accountId} = ${Account.$parentId}
         where ${Account.$accountId} in (${dataManager.childAccounts.map((z) => z.accountId)})
         order by ${Account.$email}
      `.mssql.getAll({
         db: pool.request(),
      });
      expect(actual).toBeDefined();
      const expected = dataManager.childAccounts.map((child) => {
         const parent = dataManager.rootAccounts.find((parent) => parent.accountId === child.parentId);
         ok(parent);
         return {
            ...child,
            parentFirstName: parent.firstName,
            parentLastName: parent.lastName,
            parentEmail: parent.email,
         };
      });
      expect(actual[0]).toEqual(expected[0]);
   });

   test("Fetch root accounts and their children as json array", async () => {
      const accountChildren = sql`
         select ${row(Account.as(`children`).$$)}
         from ${Account.as(`children`)}
         where ${Account.as(`children`).$parentId} = ${Account.out.$accountId}
         order by ${Account.as(`children`).$email}
      `;

      const query = sql`
         select ${row(Account.$$)}, ${jsonMany(accountChildren).as("children")}
         from ${Account} ${jsonMany(accountChildren)}
         where ${Account.$accountId} in (${dataManager.rootAccounts.map((z) => z.accountId)})
         order by ${Account.$email}
      `;

      const actual = await query.mssql.getAll({ db: pool.request() }).then((accounts) =>
         accounts.map((account) => {
            return {
               ...account,
               children: (JSON.parse(account.children) as IAccountJson[]).map((child) => ({
                  ...child,
                  createdAt: new Date(child.createdAt),
                  modifiedAt: new Date(child.modifiedAt),
               })),
            };
         }),
      );

      const childrenByParentId = (() => {
         const result = new Map<string, IAccountSelect[]>();
         for (const child of dataManager.childAccounts) {
            ok(child.parentId);
            if (!result.has(child.parentId)) result.set(child.parentId, []);
            result.get(child.parentId)!.push(child);
         }

         return result;
      })();

      const expected = dataManager.rootAccounts.map((account) => {
         return {
            ...account,
            children: childrenByParentId.get(account.accountId),
         };
      });

      expect(actual).toEqual(expected);
   });

   test("Update account by id", async () => {
      const expected = dataManager.rootAccounts[0];
      ok(expected);
      const actual = await sql`
         update ${Account}
         set ${Account.$firstName} = ${expected.firstName + "+test"}
         output ${row(Account.as(`inserted`).$$)}
         where ${Account.$accountId} = ${expected.accountId}
      `.mssql.getOneRequired({ db: pool.request() });
      expect(actual).toEqual({ ...expected, firstName: expected.firstName + "+test" });
   });

   test("Delete test accounts", async () => {
      const { rowsAffected } = await sql`
         delete
         from ${Account}
         where ${Account.$accountId} in (${dataManager.childAccounts.map((z) => z.accountId)});

         delete
         from ${Account}
         where ${Account.$accountId} in (${dataManager.rootAccounts.map((z) => z.accountId)})
      `.mssql.run({ db: pool.request() });

      expect(rowsAffected[0]! + rowsAffected[1]!).toEqual(
         dataManager.ACCOUNT_ROOT_COUNT + dataManager.ACCOUNT_ROOT_COUNT * dataManager.ACCOUNT_CHILD_FACTOR,
      );
   });
});

import { beforeAll, describe, expect, test } from "vitest";
import crypto, { randomUUID } from "node:crypto";
import { ok } from "node:assert";
import { param, sql } from "valnor";
import { Account, IAccountJson, IAccountSelect } from "./codegen/valnor_test.account-table.js";
import { AccountStatusUdt } from "./codegen/valnor_test-enums.js";
import { pool } from "./postgres-pool.js";
import { jsonAgg } from "valnor-postgres";

describe.sequential("valnor postgres e2e tests", () => {
   const rootAccounts: IAccountSelect[] = [];
   const childAccounts: IAccountSelect[] = [];
   const ROOT_COUNT = 100;
   const CHILD_FACTOR = 3;

   const findAccountById = sql<IAccountSelect, { accountId: string }>`
      select ${Account.$$all}
      from ${Account}
      where ${Account.accountId} = ${param("accountId")}
   `;

   beforeAll(async () => {
      await sql<object>`
         delete
         from ${Account}
         where ${Account.accountId} <> ${randomUUID()}
      `.pg.run({ db: pool });
   });

   beforeAll(async () => {
      // insert accounts
      {
         const newAccountsArgs = [];
         for (let i = 0; i < ROOT_COUNT; i++) {
            const id = crypto.randomUUID().slice(0, 4);
            newAccountsArgs.push({
               status: AccountStatusUdt.CREATED,
               firstName: `John-${i}-${id} (root)`,
               lastName: `Doe-${i}-${id} (root)`,
               email: `john.doe.root-${i}-${id}@example.com`,
            });
         }
         const accounts = await sql<IAccountSelect>`
            insert into ${Account}
               ${Account.$$values(...newAccountsArgs)}
               returning ${Account.$$all}
         `.pg.getAll({ db: pool });

         ok(accounts?.length, "root accounts not inserted");
         expect(accounts.length).toBe(100);
         rootAccounts.push(...accounts);
      }

      for (let i = 0; i < rootAccounts.length; i++) {
         for (let k = 0; k < CHILD_FACTOR; k++) {
            const id = crypto.randomUUID().slice(0, 4);
            const parent = rootAccounts[i];
            ok(parent);

            const account = await sql<IAccountSelect>`
            insert into ${Account}
               ${Account.$$values({
                  status: AccountStatusUdt.CREATED,
                  firstName: `John-${i}-${k}-${id} (child ${k})`,
                  lastName: `Doe-${i}-${k}-${id} (child ${k})`,
                  email: `john.doe.child-${i}-${k}-${id}@example.com`,
                  parentId: parent.accountId,
               })}
               returning ${Account.$$all}
         `.pg.getOneRequired({ db: pool });
            expect(account).toEqual(
               expect.objectContaining({
                  status: AccountStatusUdt.CREATED,
                  firstName: `John-${i}-${k}-${id} (child ${k})`,
                  lastName: `Doe-${i}-${k}-${id} (child ${k})`,
                  email: `john.doe.child-${i}-${k}-${id}@example.com`,
                  parentId: parent.accountId,
               }),
            );
            childAccounts.push(account);
         }
      }
   });

   test("Check test accounts inserted", () => {
      expect(rootAccounts.length).toBe(ROOT_COUNT);
      expect(childAccounts.length).toBe(ROOT_COUNT * CHILD_FACTOR);
   });

   test(`Fetch all ${ROOT_COUNT} root accounts`, async () => {
      const actual = await sql<IAccountSelect>`
    select ${Account.$$all}
    from ${Account}
    where ${Account.accountId} in (${rootAccounts.map((z) => z.accountId)})
`.pg.getAll({ db: pool });
      expect(actual).toEqual(rootAccounts);
   });

   test(`Fetch all ${ROOT_COUNT * CHILD_FACTOR} children accounts`, async () => {
      const actual = await sql<IAccountSelect>`
    select ${Account.$$all}
    from ${Account}
    where ${Account.accountId} in (${childAccounts.map((z) => z.accountId)})
`.pg.getAll({ db: pool });
      expect(actual).toEqual(childAccounts);
   });

   test("Fetch account required by id", async () => {
      const expected = rootAccounts[0];
      ok(expected);
      const actual = await findAccountById.pg.getOneRequired({
         db: pool,
         params: { accountId: expected.accountId },
      });
      expect(actual).toEqual(expected);
   });

   test("Fetch account optional by id", async () => {
      const actual = await findAccountById.pg.getOneOptional({
         db: pool,
         params: { accountId: randomUUID() },
      });
      expect(actual).toBeUndefined();
   });

   test("Self join account: fetch accounts with parent info (firstName, lastName, email)", async () => {
      const actual = await sql<IAccountSelect>`
         select ${Account.$$all},
                ${Account`parent`.firstName`parentFirstName`},
                ${Account`parent`.lastName`parentLastName`},
                ${Account`parent`.email`parentEmail`}
         from ${Account}
                 join ${Account`parent`} on ${Account`parent`.accountId} = ${Account.parentId}
      `.pg.getAll({
         db: pool,
      });
      expect(actual).toBeDefined();
      const expected = childAccounts.map((z) => {
         const parent = rootAccounts.find((p) => p.accountId === z.parentId);
         ok(parent);
         return {
            ...z,
            parentFirstName: parent.firstName,
            parentLastName: parent.lastName,
            parentEmail: parent.email,
         };
      });
      expect(actual).toEqual(expected);
   });

   test("Fetch root accounts and their children as json array", async () => {
      const accountChildren = sql<IAccountSelect>`
         select ${Account`children`.$$all}
         from ${Account`children`}
         where ${Account`children`.parentId} = ${Account.accountId}
         order by ${Account`children`.accountId}
      `;

      const actual = await sql<IAccountSelect & { children: IAccountJson[] }>`
         select ${Account.$$all}, ${jsonAgg(accountChildren)} as children
         from ${Account} ${jsonAgg(accountChildren)}
         where ${Account.parentId} is null
      `.pg
         .getAll({
            db: pool,
            options: {
               debug: (data) => {
                  console.log(data.text);
               },
            },
         })
         .then((accounts) =>
            accounts.map((account) => ({
               ...account,
               children: account.children.map((child) => ({
                  ...child,
                  createdAt: new Date(child.createdAt),
                  modifiedAt: new Date(child.modifiedAt),
               })),
            })),
         );

      const expected = rootAccounts.map((rootAccount) => {
         const children = childAccounts
            .filter((c) => c.parentId === rootAccount.accountId)
            .sort((a, b) => a.accountId.localeCompare(b.accountId));
         return {
            ...rootAccount,
            children,
         };
      });

      expect(actual).toEqual(expected);
   });

   test("Update account by id", async () => {
      const expected = rootAccounts[0];
      ok(expected);
      const actual = await sql<IAccountSelect>`
         update ${Account}
         set ${Account.firstName} = ${expected.firstName + "+test"}
         where ${Account.accountId} = ${expected.accountId}
         returning ${Account.$$all}
      `.pg.getOneRequired({ db: pool });
      expect(actual).toEqual({ ...expected, firstName: expected.firstName + "+test" });
   });

   test("Delete test accounts", async () => {
      const { rowCount } = await sql<object>`
         delete
         from ${Account}
         where ${Account.accountId} in (${rootAccounts.map((z) => z.accountId)})
      `.pg.run({ db: pool });
      expect(rowCount).toEqual(rootAccounts.length);
   });
});

import { afterAll, beforeAll, describe, expect, test } from "vitest";
import crypto, { randomUUID } from "node:crypto";
import assert, { ok } from "node:assert";
import { param, sql } from "valnor";
import { Account, IAccountInsert, IAccountJson, IAccountSelect } from "./codegen/valnor_test.account-table.js";
import { pool } from "./mssql-pool.js";
import { jsonAgg } from "valnor-mssql";

describe.sequential("valnor mssql e2e tests", () => {
   const rootAccounts: IAccountSelect[] = [];
   const childAccounts: IAccountSelect[] = [];
   const ROOT_COUNT = 100;
   const CHILD_FACTOR = 3;

   const findAccountById = sql<IAccountSelect, { accountId: string }>`
      select ${Account.$$all}
      from ${Account}
      where ${Account.accountId} = ${param("accountId")}
   `;

   afterAll(async () => {
      await pool.close();
   });

   beforeAll(async () => {
      await pool.connect();
      await sql<object>`
         delete
         from ${Account}
         where ${Account.accountId} <> ${randomUUID()}
      `.mssql.run({ db: pool.request() });
   });

   beforeAll(async () => {
      {
         const newAccountsArgs = [];
         for (let i = 0; i < ROOT_COUNT; i++) {
            const id = crypto.randomUUID().slice(0, 4);
            const index = String(i).padStart(3, "0");
            newAccountsArgs.push({
               status: "CREATED",
               firstName: `John-${index}-${id} (root)`,
               lastName: `Doe-${index}-${id} (root)`,
               email: `john.doe.root-${index}-${id}@example.com`,
            });
         }
         const accounts = await sql<IAccountSelect>`
            insert into ${Account}
               ${Account.$$cols(...newAccountsArgs)}
               output ${Account`inserted`.$$all}
               ${Account.$$rows(...newAccountsArgs)}
         `.mssql
            .getAll({
               db: pool.request(),
               options: {
                  debug: (data) => {
                     console.log(data.text);
                  },
               },
            })
            .catch((err) => console.error(err));

         ok(accounts?.length, "root accounts not inserted");
         assert.deepEqual(accounts.length, ROOT_COUNT);
         // expect(accounts.length).toBe(ROOT_COUNT);
         rootAccounts.push(...accounts);
      }

      for (let i = 0; i < rootAccounts.length; i++) {
         const rootIndex = String(i).padStart(3, "0");
         for (let k = 0; k < CHILD_FACTOR; k++) {
            const childIndex = String(k).padStart(3, "0");
            const id = crypto.randomUUID().slice(0, 4);
            const parent = rootAccounts[i]!;
            ok(parent);

            const accountInsert: IAccountInsert = {
               status: "CREATED",
               firstName: `John-${rootIndex}-${childIndex}-${id} (child ${childIndex})`,
               lastName: `Doe-${rootIndex}-${childIndex}-${id} (child ${childIndex})`,
               email: `john.doe.child-${rootIndex}-${childIndex}-${id}@example.com`,
               parentId: parent.accountId,
            };
            const account = await sql<IAccountSelect>`
               insert into ${Account}
                  ${Account.$$cols(accountInsert)}
                  output ${Account`inserted`.$$all}
                  ${Account.$$rows(accountInsert)}
            `.mssql.getOneRequired({ db: pool.request() });
            expect(account).toEqual(
               expect.objectContaining({
                  status: "CREATED",
                  firstName: `John-${rootIndex}-${childIndex}-${id} (child ${childIndex})`,
                  lastName: `Doe-${rootIndex}-${childIndex}-${id} (child ${childIndex})`,
                  email: `john.doe.child-${rootIndex}-${childIndex}-${id}@example.com`,
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
         order by ${Account.email}
      `.mssql.getAll({ db: pool.request() });

      expect(actual).toEqual(rootAccounts);
   });

   test(`Fetch all ${ROOT_COUNT * CHILD_FACTOR} children accounts`, async () => {
      const actual = await sql<IAccountSelect>`
    select ${Account.$$all}
    from ${Account}
    where ${Account.accountId} in (${childAccounts.map((z) => z.accountId)})
    order by ${Account.email} asc
`.mssql.getAll({ db: pool.request() });
      expect(actual).toEqual(childAccounts);
   });

   test("Fetch account required by id", async () => {
      const expected = rootAccounts[0];
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
      const actual = await sql<IAccountSelect>`
         select ${Account.$$all},
                ${Account`parent`.firstName`parentFirstName`},
                ${Account`parent`.lastName`parentLastName`},
                ${Account`parent`.email`parentEmail`}
         from ${Account}
                 join ${Account`parent`} on ${Account`parent`.accountId} = ${Account.parentId}
         where ${Account.accountId} in (${childAccounts.map((z) => z.accountId)})
         order by ${Account.email}
      `.mssql.getAll({
         db: pool.request(),
      });
      expect(actual).toBeDefined();
      const expected = childAccounts.map((child) => {
         const parent = rootAccounts.find((parent) => parent.accountId === child.parentId);
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
      const accountChildren = sql<IAccountSelect>`
         select ${Account`children`.$$all}
         from ${Account`children`}
         where ${Account`children`.parentId} = ${Account.accountId}
         order by ${Account`children`.email}
      `;

      const actual = await sql<IAccountSelect & { children: string }>`
         select ${Account.$$all}, ${jsonAgg(accountChildren)} as children
         from ${Account} ${jsonAgg(accountChildren)}
         where ${Account.accountId} in (${rootAccounts.map((z) => z.accountId)})
         order by ${Account.email}
      `.mssql
         .getAll({ db: pool.request() })
         .then((accounts) =>
            accounts.map((account) => ({
               ...account,
               children: (JSON.parse(account.children) as IAccountJson[]).map((child) => ({
                  ...child,
                  createdAt: new Date(child.createdAt),
                  modifiedAt: new Date(child.modifiedAt),
               })),
            })),
         );

      const childrenByParentId = (() => {
         const result = new Map<string, IAccountSelect[]>();
         for (const child of childAccounts) {
            ok(child.parentId);
            if (!result.has(child.parentId)) result.set(child.parentId, []);
            result.get(child.parentId)!.push(child);
         }

         return result;
      })();

      const expected = rootAccounts.map((account) => {
         return {
            ...account,
            children: childrenByParentId.get(account.accountId),
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
         output ${Account`inserted`.$$all}
         where ${Account.accountId} = ${expected.accountId}
      `.mssql.getOneRequired({ db: pool.request() });
      expect(actual).toEqual({ ...expected, firstName: expected.firstName + "+test" });
   });

   test("Delete test accounts", async () => {
      const { rowsAffected } = await sql<object>`
         delete
         from ${Account}
         where ${Account.accountId} in (${childAccounts.map((z) => z.accountId)});

         delete
         from ${Account}
         where ${Account.accountId} in (${rootAccounts.map((z) => z.accountId)})
      `.mssql.run({ db: pool.request() });

      expect(rowsAffected[0]! + rowsAffected[1]!).toEqual(ROOT_COUNT + ROOT_COUNT * CHILD_FACTOR);
   });
});

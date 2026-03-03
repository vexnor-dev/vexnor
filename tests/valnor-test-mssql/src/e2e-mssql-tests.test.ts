import { beforeAll, describe, expect, test } from "vitest";
import crypto, { randomUUID } from "node:crypto";
import assert, { ok } from "node:assert";
import { param, row, sql } from "valnor";
import { jsonMany } from "valnor-mssql";
import { Account, IAccountInsert, IAccountJson, IAccountSelect } from "./codegen/valnor_test.schema.js";
import { getTag } from "./config.js";
import { pool } from "./mssql-pool.js";

describe.sequential("valnor mssql e2e tests", async (ctx) => {
   const TAG = getTag(ctx);

   const rootAccounts: IAccountSelect[] = [];
   const childAccounts: IAccountSelect[] = [];
   const ROOT_COUNT = 100;
   const CHILD_FACTOR = 3;

   const findAccountById = sql`
      select ${row(Account.$$)}
      from ${Account}
      where ${Account.$accountId} = ${param<{ accountId: string }>("accountId")}
   `;

   beforeAll(async () => {
      {
         const newAccountsArgs = [];
         for (let i = 0; i < ROOT_COUNT; i++) {
            const id = crypto.randomUUID().slice(0, 4);
            const index = String(i).padStart(3, "0");
            newAccountsArgs.push({
               status: "CREATED",
               firstName: `John-${index}-${id} (root)-${TAG}`,
               lastName: `Doe-${index}-${id} (root)-${TAG}`,
               email: `john.doe.root-${index}-${id}-${TAG}@example.com`,
            });
         }
         const accounts = await sql`
            insert into ${Account}
               ${Account.insertCols(...newAccountsArgs)}
               output ${row(Account.as(`inserted`).$$)}
               ${Account.insertVals(...newAccountsArgs)}
         `.mssql.getAll({
            db: pool.request(),
            options: {
               debug: (data) => {
                  console.log(data.text);
               },
            },
         });

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
               firstName: `John-${rootIndex}-${childIndex}-${id} (child ${childIndex})-${TAG}`,
               lastName: `Doe-${rootIndex}-${childIndex}-${id} (child ${childIndex})-${TAG}`,
               email: `john.doe.child-${rootIndex}-${childIndex}-${id}-${TAG}@example.com`,
               parentId: parent.accountId,
            };
            const account = await sql`
               insert into ${Account}
                  ${Account.insertCols(accountInsert)}
                  output ${row(Account.as(`inserted`).$$)}
                  ${Account.insertVals(accountInsert)}
            `.mssql.getOneRequired({ db: pool.request() });
            expect(account).toEqual(
               expect.objectContaining({
                  status: "CREATED",
                  firstName: `John-${rootIndex}-${childIndex}-${id} (child ${childIndex})-${TAG}`,
                  lastName: `Doe-${rootIndex}-${childIndex}-${id} (child ${childIndex})-${TAG}`,
                  email: `john.doe.child-${rootIndex}-${childIndex}-${id}-${TAG}@example.com`,
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
      const actual = await sql`
         select ${row(Account.$$)}
         from ${Account}
         where ${Account.$accountId} in (${rootAccounts.map((z) => z.accountId)})
         order by ${Account.$email}
      `.mssql.getAll({ db: pool.request() });

      expect(actual).toEqual(rootAccounts);
   });

   test(`Fetch all ${ROOT_COUNT * CHILD_FACTOR} children accounts`, async () => {
      const actual = await sql`
    select ${Account.$$}
    from ${Account}
    where ${Account.$accountId} in (${childAccounts.map((z) => z.accountId)})
    order by ${Account.$email} asc
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
      const actual = await sql`
         select ${row(Account.$$, Account.as(`parent`).$firstName.as(`parentFirstName`), Account.as(`parent`).$lastName.as(`parentLastName`), Account.as(`parent`).$email.as(`parentEmail`))}
         from ${Account}
                 join ${Account.as(`parent`)} on ${Account.as(`parent`).$accountId} = ${Account.$parentId}
         where ${Account.$accountId} in (${childAccounts.map((z) => z.accountId)})
         order by ${Account.$email}
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
      const accountChildren = sql`
         select ${row(Account.as(`children`).$$)}
         from ${Account.as(`children`)}
         where ${Account.as(`children`).$parentId} = ${Account.out.$accountId}
         order by ${Account.as(`children`).$email}
      `;

      const query = sql`
         select ${row(Account.$$)}, ${jsonMany(accountChildren).as("children")}
         from ${Account} ${jsonMany(accountChildren)}
         where ${Account.$accountId} in (${rootAccounts.map((z) => z.accountId)})
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
         where ${Account.$accountId} in (${childAccounts.map((z) => z.accountId)});

         delete
         from ${Account}
         where ${Account.$accountId} in (${rootAccounts.map((z) => z.accountId)})
      `.mssql.run({ db: pool.request() });

      expect(rowsAffected[0]! + rowsAffected[1]!).toEqual(ROOT_COUNT + ROOT_COUNT * CHILD_FACTOR);
   });
});

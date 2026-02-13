import { afterAll, beforeAll, describe, expect, test } from "vitest";
import crypto, { randomUUID } from "node:crypto";
import { ok } from "node:assert";
import { param, row, sql } from "valnor";
import { jsonMany } from "valnor-sqlite3";
import { Account, IAccountInsert, IAccountSelect } from "./codegen/main.account-table.js";
import Database from "better-sqlite3";
import { SQLITE_PATH } from "./config.js";

describe.sequential("valnor sqlite3 e2e tests", () => {
   const rootAccounts: IAccountSelect[] = [];
   const childAccounts: IAccountSelect[] = [];
   const ROOT_COUNT = 100;
   const CHILD_FACTOR = 3;
   const db = new Database(SQLITE_PATH);

   const findAccountById = sql`
      select ${row(Account.$$)}
      from ${Account}
      where ${Account.$accountId} = ${param<{ accountId: string }>("accountId")}
   `;

   afterAll(async () => {
      db.close();
   });

   beforeAll(async () => {
      await sql`
         delete
         from ${Account}
         where ${Account.$accountId} <> ${randomUUID()}
      `.sqlite3.run({ db: db });
   });

   beforeAll(async () => {
      // insert accounts
      {
         const newAccountsArgs: IAccountInsert[] = [];
         for (let i = 0; i < ROOT_COUNT; i++) {
            const index = String(i).padStart(3, "0");
            const id = crypto.randomUUID().slice(0, 4);
            newAccountsArgs.push({
               accountId: randomUUID(),
               status: "created",
               firstName: `John-${index}-${id} (root)`,
               lastName: `Doe-${index}-${id} (root)`,
               email: `john.doe.root-${index}-${id}@example.com`,
            });
         }
         await sql`
            insert into ${Account}
               ${Account.insertColsVals(...newAccountsArgs)}
         `.sqlite3.run({ db });

         const accounts = await sql`
            select ${row(Account.$$)}
            from ${Account}
            where ${Account.$accountId} in (${newAccountsArgs.map((z) => z.accountId)})
         `.sqlite3.getAll({ db });

         ok(accounts?.length, "root accounts not inserted");
         expect(accounts.length).toBe(100);
         rootAccounts.push(...accounts);
      }

      for (let i = 0; i < rootAccounts.length; i++) {
         const rootIndex = String(i).padStart(3, "0");
         for (let k = 0; k < CHILD_FACTOR; k++) {
            const childIndex = String(k).padStart(3, "0");
            const id = crypto.randomUUID().slice(0, 4);
            const parent = rootAccounts[i];
            ok(parent);

            const newAccount: IAccountInsert = {
               accountId: randomUUID(),
               status: "created",
               firstName: `John-${rootIndex}-${childIndex}-${id} (child ${childIndex})`,
               lastName: `Doe-${rootIndex}-${childIndex}-${id} (child ${childIndex})`,
               email: `john.doe.child-${rootIndex}-${childIndex}-${id}@example.com`,
               parentId: parent.accountId,
            };

            await sql`
               insert into ${Account}
                  ${Account.insertColsVals(newAccount)}
            `.sqlite3.run({ db });

            const account = await sql`
               select ${row(Account.$$)}
               from ${Account}
               where ${Account.$accountId} = ${newAccount.accountId};
            `.sqlite3.getOneRequired({ db });

            expect(account).toEqual(
               expect.objectContaining({
                  status: "created",
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
      const actual = await sql`
         select ${row(Account.$$)}
         from ${Account}
         where ${Account.$accountId} in (${rootAccounts.map((z) => z.accountId)})
      `.sqlite3.getAll({ db });
      expect(actual).toEqual(rootAccounts);
   });

   test(`Fetch all ${ROOT_COUNT * CHILD_FACTOR} children accounts`, async () => {
      const actual = await sql`
         select ${row(Account.$$)}
         from ${Account}
         where ${Account.$accountId} in (${childAccounts.map((z) => z.accountId)})
         order by ${Account.$email}
      `.sqlite3.getAll({ db });
      expect(actual).toEqual(childAccounts);
   });

   test("Fetch account required by id", async () => {
      const expected = rootAccounts[0];
      ok(expected);
      const actual = await findAccountById.sqlite3.getOneRequired({
         db,
         params: { accountId: expected.accountId },
      });
      expect(actual).toEqual(expected);
   });

   test("Fetch account optional by id", async () => {
      const actual = await findAccountById.sqlite3.getOneOptional({
         db,
         params: { accountId: randomUUID() },
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
      `.sqlite3.getAll({
         db,
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
      const accountChildren = sql`
         select ${row(Account.as`children`.$$)}
         from ${Account.as`children`}
         where ${Account.as`children`.$parentId} = ${Account.$accountId}
         order by ${Account.as`children`.$accountId}
      `;

      const query = sql`
         select ${row(Account.$$)}, ${jsonMany(accountChildren).as("children")}
         from ${Account}
         where ${Account.$accountId} in (${rootAccounts.map((z) => z.accountId)})
      `;
      const { text } = query.getSql({ options: { dialect: "sqlite" } });
      expect(text).toMatchInlineSnapshot(`
        "SELECT
          "a_1"."account_id" AS "accountId",
          "a_1"."status",
          "a_1"."email",
          "a_1"."first_name" AS "firstName",
          "a_1"."last_name" AS "lastName",
          "a_1"."notes",
          "a_1"."created_at" AS "createdAt",
          "a_1"."modified_at" AS "modifiedAt",
          "a_1"."parent_id" AS "parentId",
          (
            SELECT
              coalesce(
                json_group_array(
                  json_object(
                    'accountId',
                    "accountId",
                    'status',
                    "status",
                    'email',
                    "email",
                    'firstName',
                    "firstName",
                    'lastName',
                    "lastName",
                    'notes',
                    "notes",
                    'createdAt',
                    "createdAt",
                    'modifiedAt',
                    "modifiedAt",
                    'parentId',
                    "parentId"
                  )
                ),
                '[]'
              )
            FROM
              (
                SELECT
                  "children"."account_id" AS "accountId",
                  "children"."status",
                  "children"."email",
                  "children"."first_name" AS "firstName",
                  "children"."last_name" AS "lastName",
                  "children"."notes",
                  "children"."created_at" AS "createdAt",
                  "children"."modified_at" AS "modifiedAt",
                  "children"."parent_id" AS "parentId"
                FROM
                  "main"."account" AS "children"
                WHERE
                  "children"."parent_id" = "a_1"."account_id"
                ORDER BY
                  "children"."account_id"
              ) AS "query_1"
          ) AS "children"
        FROM
          "main"."account" AS "a_1"
        WHERE
          "a_1"."account_id" IN (
            ?,
            ?,
            ?,
            ?,
            ?,
            ?,
            ?,
            ?,
            ?,
            ?,
            ?,
            ?,
            ?,
            ?,
            ?,
            ?,
            ?,
            ?,
            ?,
            ?,
            ?,
            ?,
            ?,
            ?,
            ?,
            ?,
            ?,
            ?,
            ?,
            ?,
            ?,
            ?,
            ?,
            ?,
            ?,
            ?,
            ?,
            ?,
            ?,
            ?,
            ?,
            ?,
            ?,
            ?,
            ?,
            ?,
            ?,
            ?,
            ?,
            ?,
            ?,
            ?,
            ?,
            ?,
            ?,
            ?,
            ?,
            ?,
            ?,
            ?,
            ?,
            ?,
            ?,
            ?,
            ?,
            ?,
            ?,
            ?,
            ?,
            ?,
            ?,
            ?,
            ?,
            ?,
            ?,
            ?,
            ?,
            ?,
            ?,
            ?,
            ?,
            ?,
            ?,
            ?,
            ?,
            ?,
            ?,
            ?,
            ?,
            ?,
            ?,
            ?,
            ?,
            ?,
            ?,
            ?,
            ?,
            ?,
            ?,
            ?
          )"
      `);

      const actual = await query.sqlite3.getAll({ db }).then((accounts) =>
         accounts.map((account) => ({
            ...account,
            children: (JSON.parse(account.children) as IAccountSelect[]).map((child) => ({
               ...child,
            })),
         })),
      );

      const childrenByParentId = (() => {
         const result = new Map<string, IAccountSelect[]>();
         for (const child of childAccounts) {
            ok(child.parentId);
            const children = (() => {
               if (!result.has(child.parentId)) {
                  result.set(child.parentId, []);
               }

               return result.get(child.parentId)!;
            })();
            children.push(child);
            children.sort((a, b) => a.accountId.localeCompare(b.accountId));
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
      await sql`
         update ${Account}
         set ${Account.$firstName} = ${expected.firstName + "+test"}
         where ${Account.$accountId} = ${expected.accountId}
      `.sqlite3.run({ db });

      const actual = await findAccountById.sqlite3.getOneRequired({
         db,
         params: { accountId: expected.accountId },
      });

      expect(actual).toEqual({ ...expected, firstName: expected.firstName + "+test" });
   });

   test("Delete test accounts", async () => {
      const { changes } = await sql`
         delete
         from ${Account}
         where ${Account.$accountId} in (${rootAccounts.map((z) => z.accountId)})
      `.sqlite3.run({ db });
      expect(changes).toEqual(rootAccounts.length);
   });
});

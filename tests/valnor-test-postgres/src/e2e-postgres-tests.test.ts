import { afterAll, beforeAll, describe, expect, test } from "vitest";
import crypto, { randomUUID } from "node:crypto";
import { ok } from "node:assert";
import { param, row, rowType, sql } from "valnor";
import { Account, IAccountSelect } from "./codegen/valnor_test.account-table.js";
import { AccountStatusUdt } from "./codegen/valnor_test-enums.js";
import { pool } from "./postgres-pool.js";
import { jsonMany } from "valnor-postgres";

describe.sequential("valnor postgres e2e tests", () => {
   const rootAccounts: IAccountSelect[] = [];
   const childAccounts: IAccountSelect[] = [];
   const ROOT_COUNT = 100;
   const CHILD_FACTOR = 3;

   const findAccountById = sql`
         select ${row(Account.$$)}
      from ${Account}
      where ${Account.$accountId} = ${param("accountId").is<string>()}
   `;

   afterAll(async () => {
      await pool.end();
   });

   beforeAll(async () => {
      await sql`
         delete
         from ${Account}
         where ${Account.$accountId} <> ${randomUUID()}
      `.postgres.run({ db: pool });
   });

   beforeAll(async () => {
      // insert accounts
      {
         const newAccountsArgs = [];
         for (let i = 0; i < ROOT_COUNT; i++) {
            const index = String(i).padStart(3, "0");
            const id = crypto.randomUUID().slice(0, 4);
            newAccountsArgs.push({
               status: AccountStatusUdt.CREATED,
               firstName: `John-${index}-${id} (root)`,
               lastName: `Doe-${index}-${id} (root)`,
               email: `john.doe.root-${index}-${id}@example.com`,
            });
         }
         const accounts = await sql`
            insert into ${Account}
               ${Account.insertColsVals(...newAccountsArgs)}
               returning ${row(Account.$$)}
         `.postgres.getAll({ db: pool });

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

            const account = await sql`
            insert into ${Account}
               ${Account.insertColsVals({
                  status: AccountStatusUdt.CREATED,
                  firstName: `John-${rootIndex}-${childIndex}-${id} (child ${childIndex})`,
                  lastName: `Doe-${rootIndex}-${childIndex}-${id} (child ${childIndex})`,
                  email: `john.doe.child-${rootIndex}-${childIndex}-${id}@example.com`,
                  parentId: parent.accountId,
               })}
               returning ${row(Account.$$)}
         `.postgres.getOneRequired({ db: pool });
            expect(account).toEqual(
               expect.objectContaining({
                  status: AccountStatusUdt.CREATED,
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
         order by ${Account.$email}
      `.postgres.getAll({ db: pool });
      expect(actual).toEqual(rootAccounts);
   });

   test(`Fetch all ${ROOT_COUNT * CHILD_FACTOR} children accounts`, async () => {
      const actual = await sql`
         select ${row(Account.$$)}
         from ${Account}
         where ${Account.$accountId} in (${childAccounts.map((z) => z.accountId)})
         order by ${Account.$email}
      `.postgres.getAll({ db: pool });
      expect(actual).toEqual(childAccounts);
   });

   test("Fetch account required by id", async () => {
      const expected = rootAccounts[0];
      ok(expected);
      const actual = await findAccountById.postgres.getOneRequired({
         db: pool,
         params: { accountId: expected.accountId },
      });
      expect(actual).toEqual(expected);
   });

   test("Fetch account optional by id", async () => {
      const actual = await findAccountById.postgres.getOneOptional({
         db: pool,
         params: { accountId: randomUUID() },
      });
      expect(actual).toBeUndefined();
   });

   test("Self join account: fetch accounts with parent info (firstName, lastName, email)", async () => {
      const actual = await sql`
        ${rowType<IAccountSelect>()}
         select ${row(
            Account.$$,
            Account.as`parent`.$firstName.as(`parentFirstName`),
            Account.as`parent`.$lastName.as(`parentLastName`),
            Account.as`parent`.$email.as(`parentEmail`),
         )}
         from ${Account}
                 join ${Account.as`parent`} on ${Account.as`parent`.$accountId} = ${Account.$parentId}
         where ${Account.$accountId} in (${childAccounts.map((z) => z.accountId)})
         order by ${Account.$email}
      `.postgres.getAll({
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
      const accountChildren = sql`
         select ${row(Account.as`children`.$$)}
         from ${Account.as`children`}
         where ${Account.as`children`.$parentId} = ${Account.$accountId}
         order by ${Account.as`children`.$email}
      `;

      const query = sql`
         select ${row(Account.$$)}, ${jsonMany(accountChildren).as("children")}
         from ${Account} ${jsonMany(accountChildren)}
         where ${Account.$accountId} in (${rootAccounts.map((z) => z.accountId)})
         order by ${Account.$email}
      `;
      expect(query.getSql({}).text).toMatchInlineSnapshot(`
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
          "query_1_result" AS "children"
        FROM
          "valnor_test"."account" AS "a_1"
          LEFT JOIN LATERAL (
            SELECT
              coalesce(jsonb_agg ("query_1".*), '[]') AS "query_1_result"
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
                  "valnor_test"."account" AS "children"
                WHERE
                  "children"."parent_id" = "a_1"."account_id"
                ORDER BY
                  "children"."email"
              ) AS "query_1"
          ) AS "query_1" ON TRUE
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
          )
        ORDER BY
          "a_1"."email""
      `);

      const actual = await query.postgres.getAll({ db: pool }).then((accounts) =>
         accounts.map((account) => ({
            ...account,
            children: account.children.map((child) => ({
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
      const actual = await sql`
            ${rowType<IAccountSelect>()}
         update ${Account}
         set ${Account.$firstName} = ${expected.firstName + "+test"}
         where ${Account.$accountId} = ${expected.accountId}
         returning ${Account.$$}
      `.postgres.getOneRequired({ db: pool });
      expect(actual).toEqual({ ...expected, firstName: expected.firstName + "+test" });
   });

   test("Delete test accounts", async () => {
      const { rowCount } = await sql`
         delete
         from ${Account}
         where ${Account.$accountId} in (${rootAccounts.map((z) => z.accountId)})
      `.postgres.run({ db: pool });
      expect(rowCount).toEqual(rootAccounts.length);
   });
});

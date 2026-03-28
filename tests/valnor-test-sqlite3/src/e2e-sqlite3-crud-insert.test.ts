import { describe, expect, test } from "vitest";
import { ok } from "node:assert";
import { randomUUID } from "node:crypto";
import { row, val } from "valnor";
import { sql, sqlite3InsertRows, sqlite3InsertFrom } from "valnor-sqlite3";
import { Account, IAccountInsert } from "./codegen/main.account-table.js";
import { db } from "./config.js";

describe.sequential("valnor sqlite3 CRUD - insert", () => {
   test("insertRows: single row returns full select", async () => {
      const insert: IAccountInsert = {
         accountId: randomUUID(),
         email: `insert-rows-single-${randomUUID()}@example.com`,
         firstName: "Insert",
         lastName: "Single",
      };

      const result = await sqlite3InsertRows(Account).one({ db, params: { rows: [insert] } });

      expect(result).toEqual(
         expect.objectContaining({
            accountId: insert.accountId,
            email: insert.email,
            firstName: insert.firstName,
            lastName: insert.lastName,
            status: "created",
         }),
      );
   });

   test("insertRows: multiple rows returns all", async () => {
      const inserts: IAccountInsert[] = [
         {
            accountId: randomUUID(),
            email: `insert-rows-multi-1-${randomUUID()}@example.com`,
            firstName: "Multi",
            lastName: "One",
         },
         {
            accountId: randomUUID(),
            email: `insert-rows-multi-2-${randomUUID()}@example.com`,
            firstName: "Multi",
            lastName: "Two",
         },
         {
            accountId: randomUUID(),
            email: `insert-rows-multi-3-${randomUUID()}@example.com`,
            firstName: "Multi",
            lastName: "Three",
         },
      ];

      const results = await sqlite3InsertRows(Account).all({ db, params: { rows: inserts } });

      expect(results).toHaveLength(3);
      for (let i = 0; i < inserts.length; i++) {
         expect(results[i]).toEqual(
            expect.objectContaining({ accountId: inserts[i]!.accountId, email: inserts[i]!.email }),
         );
      }
   });

   test("insertFrom: inserts from SELECT and returns row", async () => {
      const parentInsert: IAccountInsert = {
         accountId: randomUUID(),
         email: `insert-from-parent-${randomUUID()}@example.com`,
         firstName: "From",
         lastName: "Parent",
      };
      const parent = await sql`
         insert into ${Account}
            ${Account.insertColsVals(parentInsert)}
         returning ${row(Account.$$)}
      `.sqlite.one({ db });

      const childId = randomUUID();

      const result = await sqlite3InsertFrom(Account, {
         FROM: sql`
            select ${row(
               val`${childId}`.as<{ accountId: string }>("accountId"),
               Account.as("src").$status,
               Account.as("src").$email,
               Account.as("src").$firstName,
               Account.as("src").$lastName,
               Account.as("src").$notes,
               Account.as("src").$createdAt,
               Account.as("src").$modifiedAt,
               Account.as("src").$parentId,
            )}
            from ${Account.as("src")}
            where ${Account.as("src").$accountId} = ${parent.accountId}
         `,
      }).one({ db });

      ok(result);
      expect(result).toEqual(
         expect.objectContaining({
            accountId: childId,
            email: parent.email,
            firstName: parent.firstName,
            lastName: parent.lastName,
         }),
      );
   });
});

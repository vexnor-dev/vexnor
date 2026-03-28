import { beforeAll, describe, expect, test } from "vitest";
import { ok } from "node:assert";
import { randomUUID } from "node:crypto";
import { param, row } from "valnor";
import { sql, sqlite3Update } from "valnor-sqlite3";
import { Account, IAccountInsert, IAccountSelect } from "./codegen/main.account-table.js";
import { db } from "./config.js";

describe.sequential("valnor sqlite3 CRUD - update", () => {
   const inserted: IAccountSelect[] = [];

   beforeAll(async () => {
      const inserts: IAccountInsert[] = [
         {
            accountId: randomUUID(),
            email: `update-test-1-${randomUUID()}@example.com`,
            firstName: "Update",
            lastName: "One",
         },
         {
            accountId: randomUUID(),
            email: `update-test-2-${randomUUID()}@example.com`,
            firstName: "Update",
            lastName: "Two",
         },
      ];
      const rows = await sql`
         insert into ${Account}
            ${Account.insertColsVals(...inserts)}
         returning ${row(Account.$$)}
      `.sqlite.all({ db });
      inserted.push(...rows);
   });

   test("update: single field with WHERE returns updated row", async () => {
      const target = inserted[0];
      ok(target);

      const result = await sqlite3Update(Account, {
         WHERE: sql`${Account.$accountId} = ${param<{ accountId: string }>("accountId")}`,
      }).one({
         db,
         params: { set: { firstName: "Updated" }, accountId: target.accountId },
      });

      expect(result).toEqual({ ...target, firstName: "Updated" });
   });

   test("update: multiple fields with WHERE returns updated row", async () => {
      const target = inserted[1];
      ok(target);

      const result = await sqlite3Update(Account, {
         WHERE: sql`${Account.$accountId} = ${param<{ accountId: string }>("accountId")}`,
      }).one({
         db,
         params: { set: { firstName: "Multi", lastName: "Updated", notes: "note" }, accountId: target.accountId },
      });

      expect(result).toEqual({ ...target, firstName: "Multi", lastName: "Updated", notes: "note" });
   });

   test("update: no WHERE (force) updates all rows and returns all", async () => {
      const results = await sqlite3Update(Account, {}).all({
         db,
         params: { set: { status: "confirmed" } },
      });

      expect(results.length).toBeGreaterThanOrEqual(inserted.length);
      for (const r of results) {
         expect(r.status).toBe("confirmed");
      }
   });
});

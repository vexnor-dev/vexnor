import { beforeAll, describe, expect, test } from "vitest";
import { ok } from "node:assert";
import { randomUUID } from "node:crypto";
import { insert, param, row } from "@vexnor/core";
import { sql, Sqlite3DeleteCommand } from "@vexnor/sqlite3";
import { Account, IAccountInsert, IAccountSelect } from "./codegen/main.account-table.js";
import { db } from "./config.js";

describe("vexnor sqlite3 CRUD - delete", { concurrent: false }, () => {
   const inserted: IAccountSelect[] = [];

   beforeAll(async () => {
      const inserts: IAccountInsert[] = Array.from({ length: 4 }, (_, i) => ({
         accountId: randomUUID(),
         email: `delete-test-${i}-${randomUUID()}@example.com`,
         firstName: "Delete",
         lastName: `Test${i}`,
      }));
      const rows = await sql`
         insert into ${Account}
            ${insert(Account, "rows")}
         returning ${row(Account.$$)}
      `.sqlite.all({ db, params: { rows: inserts } });
      inserted.push(...rows);
   });

   test("delete: with WHERE returns deleted row", async () => {
      const target = inserted[0];
      ok(target);

      const result = await new Sqlite3DeleteCommand(Account, {
         WHERE: sql`${Account.$accountId} = ${param<{ accountId: string }>("accountId")}`,
      }).execute().one({ db, params: { accountId: target.accountId } });

      expect(result).toEqual(target);

      const gone = await sql`
         select ${row(Account.$$)} from ${Account}
         where ${Account.$accountId} = ${target.accountId}
      `.sqlite.any({ db });
      expect(gone).toBeUndefined();
   });

   test("delete: with WHERE returns all deleted rows", async () => {
      const targets = inserted.slice(1, 3);
      const ids = targets.map((a) => a.accountId);

      const results = await new Sqlite3DeleteCommand(Account, {
         WHERE: sql`${Account.$accountId} in (${ids})`,
      }).execute().all({ db });

      expect(results).toHaveLength(2);
      expect(results.map((r) => r.accountId).sort()).toEqual(ids.sort());
   });

   test("delete: force deletes all rows", async () => {
      const remaining = [inserted[3]!];
      ok(remaining[0]);

      const results = await new Sqlite3DeleteCommand(Account, {
         WHERE: sql`${Account.$accountId} in (${remaining.map((a) => a.accountId)})`,
      }).execute().all({ db });

      expect(results).toHaveLength(remaining.length);
      expect(results[0]!.accountId).toBe(remaining[0].accountId);
   });

   test("delete: throws without WHERE or force", () => {
      expect(() =>
         new Sqlite3DeleteCommand(Account, {
            // @ts-expect-error intentional
            force: false,
         }),
      ).toThrow();
   });
});

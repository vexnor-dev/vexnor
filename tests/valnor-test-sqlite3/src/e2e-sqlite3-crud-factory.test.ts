import { describe, expect, test } from "vitest";
import { ok } from "node:assert";
import { randomUUID } from "node:crypto";
import { param, row } from "valnor";
import { sql, sqlite3Crud } from "valnor-sqlite3";
import { Account, IAccountInsert } from "./codegen/main.account-table.js";
import { db } from "./config.js";

describe.sequential("valnor sqlite3 CRUD - sqlite3Crud factory", () => {
   const crud = sqlite3Crud(Account);

   test("insertRows via crud factory", async () => {
      const insert: IAccountInsert = {
         accountId: randomUUID(),
         email: `crud-factory-insert-${randomUUID()}@example.com`,
         firstName: "Crud",
         lastName: "Factory",
      };
      ok(crud.insertRows);
      const result = await crud.insertRows().getOneRequired({ db, params: { rows: [insert] } });
      expect(result).toEqual(expect.objectContaining({ accountId: insert.accountId, email: insert.email }));
   });

   test("update via crud factory", async () => {
      const insert: IAccountInsert = {
         accountId: randomUUID(),
         email: `crud-factory-update-${randomUUID()}@example.com`,
         firstName: "Crud",
         lastName: "Factory",
      };
      const inserted = await sql`
         insert into ${Account} ${Account.insertColsVals(insert)} returning ${row(Account.$$)}
      `.sqlite3.getOneRequired({ db });

      ok(crud.update);
      const result = await crud.update({
         WHERE: sql`${Account.$accountId} = ${param<{ accountId: string }>("accountId")}`,
      }).getOneRequired({ db, params: { set: { firstName: "Updated" }, accountId: inserted.accountId } });
      expect(result).toEqual({ ...inserted, firstName: "Updated" });
   });

   test("delete via crud factory", async () => {
      const insert: IAccountInsert = {
         accountId: randomUUID(),
         email: `crud-factory-delete-${randomUUID()}@example.com`,
         firstName: "Crud",
         lastName: "Factory",
      };
      const inserted = await sql`
         insert into ${Account} ${Account.insertColsVals(insert)} returning ${row(Account.$$)}
      `.sqlite3.getOneRequired({ db });

      ok(crud.delete);
      const result = await crud.delete({
         WHERE: sql`${Account.$accountId} = ${param<{ accountId: string }>("accountId")}`,
      }).getOneRequired({ db, params: { accountId: inserted.accountId } });
      expect(result.accountId).toBe(inserted.accountId);
   });
});

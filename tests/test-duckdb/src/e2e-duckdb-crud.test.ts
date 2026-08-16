import { beforeAll, describe, expect, test } from "vitest";
import { param, row, sql as coreSql, val } from "@vexnor/core";
import {
   DuckDBInsertFromCommand,
   DuckDBSelectCommand,
   sql,
} from "@vexnor/duckdb";
import { Account, type IAccountSelect } from "./codegen/main.account-table.js";
import { db } from "./config.js";
import { insertAccount } from "./fixtures.js";

describe("vexnor DuckDB CRUD e2e", { concurrent: false }, () => {
   let account: IAccountSelect;

   beforeAll(async () => {
      account = await insertAccount("crud-root");
   });

   test("insertRows applies native defaults and returns every column", async () => {
      const inserted = await Account.duckdb.insertRows().one({
         db,
         params: { rows: [{ email: `crud-insert-${crypto.randomUUID()}@example.com`, firstName: "Insert", lastName: "DuckDB" }] },
      });
      const { accountId, createdAt, modifiedAt, email, ...stable } = inserted;

      expect(typeof accountId).toBe("string");
      expect(createdAt).toBeInstanceOf(Date);
      expect(modifiedAt).toBeInstanceOf(Date);
      expect(email.startsWith("crud-insert-")).toBe(true);
      expect(stable).toMatchInlineSnapshot(`
        {
          "firstName": "Insert",
          "lastName": "DuckDB",
          "notes": null,
          "parentId": null,
          "status": "created",
        }
      `);
   });

   test("insertRows returns multiple native rows", async () => {
      const prefix = crypto.randomUUID();
      const inserted = await Account.duckdb.insertRows().all({
         db,
         params: { rows: [
            { email: `${prefix}-1@example.com`, firstName: "Multi", lastName: "One" },
            { email: `${prefix}-2@example.com`, firstName: "Multi", lastName: "Two" },
         ] },
      });

      expect(inserted.map(({ firstName, lastName, status }) => ({ firstName, lastName, status }))).toMatchInlineSnapshot(`
        [
          {
            "firstName": "Multi",
            "lastName": "One",
            "status": "created",
          },
          {
            "firstName": "Multi",
            "lastName": "Two",
            "status": "created",
          },
        ]
      `);
   });

   test("select supports predicates, ordering, limit, and offset", async () => {
      const result = await new DuckDBSelectCommand(Account, {
         WHERE: sql`${Account.$accountId} = ${param<{ id: string }>("id")}`,
         ORDER_BY: sql`${Account.$email} asc`,
         limit: param<{ limit: number }>("limit"),
         offset: param<{ offset: number }>("offset"),
      }).execute().one({ db, params: { id: account.accountId, limit: 1, offset: 0 } });

      expect(result.accountId).toBe(account.accountId);
   });

   test("update returns the updated row", async () => {
      const updated = await Account.duckdb.update({
         WHERE: sql`${Account.$accountId} = ${param<{ id: string }>("id")}`,
      }).one({ db, params: { id: account.accountId, set: { status: "confirmed", notes: "native update" } } });

      expect({ status: updated.status, notes: updated.notes }).toMatchInlineSnapshot(`
        {
          "notes": "native update",
          "status": "confirmed",
        }
      `);
      account = updated;
   });

   test("upsert covers insert and conflict-update paths", async () => {
      const id = crypto.randomUUID();
      const inserted = await Account.duckdb.upsert({ CONFLICT_ON: [Account.$accountId] }).one({
         db,
         params: { rows: [{ accountId: id, email: `${id}@example.com`, firstName: "Upsert", lastName: "Insert" }] },
      });
      const updated = await Account.duckdb.upsert({ CONFLICT_ON: [Account.$accountId] }).one({
         db,
         params: { rows: [{ accountId: id, email: `${id}@example.com`, firstName: "Upsert", lastName: "Updated" }] },
      });

      expect({ inserted: inserted.lastName, updated: updated.lastName }).toMatchInlineSnapshot(`
        {
          "inserted": "Insert",
          "updated": "Updated",
        }
      `);
   });

   test("insertFrom inserts from a native select", async () => {
      const childId = crypto.randomUUID();
      const inserted = await new DuckDBInsertFromCommand(Account, {
         FROM: coreSql`
            select ${val`${childId}`.as<{ accountId: string }>("accountId")},
               ${row(
               Account.$status,
               Account.$email,
               Account.$firstName,
               Account.$lastName,
               Account.$notes,
               Account.$createdAt,
               Account.$modifiedAt,
               Account.$accountId.as("parentId"),
               )}
            from ${Account} where ${Account.$accountId} = ${account.accountId}
         `,
      }).execute().one({ db });

      expect(inserted.accountId).toBe(childId);
      expect(inserted.parentId).toBe(account.accountId);
      expect({ accountMatches: inserted.accountId === childId, parentMatches: inserted.parentId === account.accountId }).toMatchInlineSnapshot(`
        {
          "accountMatches": true,
          "parentMatches": true,
        }
      `);
   });

   test("delete returns the deleted native row", async () => {
      const doomed = await insertAccount("crud-delete");
      const deleted = await Account.duckdb.delete({ WHERE: sql`${Account.$accountId} = ${doomed.accountId}` }).one({ db });

      expect(deleted.accountId).toBe(doomed.accountId);
   });
});

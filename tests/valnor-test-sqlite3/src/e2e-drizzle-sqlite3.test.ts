import { beforeAll, describe, expect, test } from "vitest";
import { ok } from "node:assert";
import { randomUUID } from "node:crypto";
import { sqliteTable, text } from "drizzle-orm/sqlite-core";
import { fromDrizzle } from "valnor-drizzle/sqlite";
import { row, sql, param, excluded } from "valnor";
import "valnor-sqlite3";
import { db } from "./config.js";

const accountDrizzle = sqliteTable("account", {
   accountId: text("account_id").primaryKey(),
   status: text("status").default("created"),
   email: text("email").notNull(),
   firstName: text("first_name").notNull(),
   lastName: text("last_name").notNull(),
   notes: text("notes"),
   createdAt: text("created_at"),
   modifiedAt: text("modified_at"),
   parentId: text("parent_id"),
});

const Account = fromDrizzle(accountDrizzle, "main");

describe.sequential("e2e drizzle/sqlite — fromDrizzle table works against real DB", () => {
   const TAG = "drizzle-sqlite-e2e";
   let account!: typeof accountDrizzle.$inferSelect;

   beforeAll(async () => {
      account = await Account.sqlite.insertRows().one({
         db,
         params: {
            rows: [{ accountId: randomUUID(), email: `${TAG}@example.com`, firstName: "Drizzle", lastName: "Test" }],
         },
      });
      ok(account, "account not inserted");
   });

   test("sql: insert and select", async () => {
      const accountId = randomUUID();

      await sql`
         INSERT INTO ${Account}
            ${Account.insertColsVals({ accountId, email: `${TAG}-sql@example.com`, firstName: "SqlDrizzle", lastName: "Test" })}
      `.sqlite.run({ db });

      const selected = await sql`
         SELECT ${row(Account.$$)} FROM ${Account}
         WHERE ${Account.$accountId} = ${accountId}
      `.sqlite.one({ db });

      expect(selected.email).toBe(`${TAG}-sql@example.com`);
      expect(selected.firstName).toBe("SqlDrizzle");

      await sql`DELETE FROM ${Account} WHERE ${Account.$accountId} = ${accountId}`.sqlite.run({ db });
   });

   test("crud: insertRows", async () => {
      expect(account.email).toBe(`${TAG}@example.com`);
      expect(account.firstName).toBe("Drizzle");
      expect(account.accountId).toBeDefined();
   });

   test("crud: findById", async () => {
      const result = await Account.sqlite.findById().any({ db, params: { accountId: account.accountId } });
      expect(result?.accountId).toBe(account.accountId);
      expect(result?.email).toBe(account.email);
   });

   test("crud: findBy", async () => {
      const result = await Account.sqlite.findBy().any({ db, params: { email: account.email } });
      expect(result?.accountId).toBe(account.accountId);
   });

   test("crud: select with WHERE", async () => {
      const idParam = param<{ id: string }>("id");
      const results = await Account.sqlite
         .select({
            WHERE: sql`${Account.$accountId} = ${idParam}`,
         })
         .all({ db, params: { id: account.accountId } });
      expect(results).toHaveLength(1);
      expect(results[0]!.accountId).toBe(account.accountId);
   });

   test("crud: update", async () => {
      const idParam = param<{ id: string }>("id");
      const updated = await Account.sqlite
         .update({
            WHERE: sql`${Account.$accountId} = ${idParam}`,
         })
         .one({ db, params: { set: { firstName: "Updated" }, id: account.accountId } });
      expect(updated.firstName).toBe("Updated");
      account = updated;
   });

   test("crud: upsert", async () => {
      const upserted = await Account.sqlite.upsert({ CONFLICT_ON: [Account.$accountId] }).one({
         db,
         params: {
            rows: [{ accountId: account.accountId, email: account.email, firstName: "Upserted", lastName: "Test" }],
         },
      });
      expect(upserted.accountId).toBe(account.accountId);
      expect(upserted.firstName).toBe("Upserted");
      account = upserted;
   });

   test("crud: upsert with custom SET", async () => {
      const upserted = await Account.sqlite
         .upsert({
            CONFLICT_ON: [Account.$accountId],
            SET: sql`${Account.$firstName} = ${excluded(Account).$firstName}`,
         })
         .one({
            db,
            params: {
               rows: [
                  { accountId: account.accountId, email: account.email, firstName: "UpsertedCustom", lastName: "Test" },
               ],
            },
         });
      expect(upserted.firstName).toBe("UpsertedCustom");
      account = upserted;
   });

   test("crud: delete", async () => {
      const deleted = await Account.sqlite
         .delete({
            WHERE: sql`${Account.$accountId} = ${param<{ id: string }>("id")}`,
         })
         .all({ db, params: { id: account.accountId } });
      expect(deleted).toHaveLength(1);
      expect(deleted[0]!.accountId).toBe(account.accountId);
   });
});

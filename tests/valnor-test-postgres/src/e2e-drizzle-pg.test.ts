import { beforeAll, describe, expect, test } from "vitest";
import { ok } from "node:assert";
import { pgSchema, uuid, varchar, text, timestamp } from "drizzle-orm/pg-core";
import { fromDrizzle } from "valnor-drizzle/pg";
import { row, sql, param } from "valnor";
import "valnor-postgres";
import { pool } from "./postgres-pool.js";

const schema = pgSchema("valnor_test");

const accountDrizzle = schema.table("account", {
   accountId: uuid("account_id").primaryKey().defaultRandom(),
   status: varchar("status").default("created"),
   email: varchar("email").notNull(),
   firstName: varchar("first_name").notNull(),
   lastName: varchar("last_name").notNull(),
   notes: text("notes"),
   createdAt: timestamp("created_at").defaultNow(),
   modifiedAt: timestamp("modified_at").defaultNow(),
   parentId: uuid("parent_id"),
});

const Account = fromDrizzle(accountDrizzle);

describe.sequential("e2e drizzle/pg — fromDrizzle table works against real DB", () => {
   const TAG = "drizzle-pg-e2e";
   let account!: typeof accountDrizzle.$inferSelect;

   beforeAll(async () => {
      account = await Account.postgres.insertRows().one({
         db: pool,
         params: { rows: [{ email: `${TAG}@example.com`, firstName: "Drizzle", lastName: "Test" }] },
      });
      ok(account, "account not inserted");
   });

   test("sql: insert and select", async () => {
      const inserted = await sql`
         INSERT INTO ${Account}
            ${Account.insertColsVals({ email: `${TAG}-sql@example.com`, firstName: "SqlDrizzle", lastName: "Test" })}
            RETURNING ${row(Account.$$)}
      `.postgres.one({ db: pool });

      expect(inserted.email).toBe(`${TAG}-sql@example.com`);
      expect(inserted.firstName).toBe("SqlDrizzle");
      expect(inserted.accountId).toBeDefined();

      await sql`DELETE FROM ${Account} WHERE ${Account.$accountId} = ${inserted.accountId}`.postgres.run({ db: pool });
   });

   test("crud: insertRows", async () => {
      expect(account.email).toBe(`${TAG}@example.com`);
      expect(account.firstName).toBe("Drizzle");
      expect(account.accountId).toBeDefined();
   });

   test("crud: findById", async () => {
      const result = await Account.postgres.findById().any({ db: pool, params: { accountId: account.accountId } });
      expect(result?.accountId).toBe(account.accountId);
      expect(result?.email).toBe(account.email);
   });

   test("crud: findBy", async () => {
      const result = await Account.postgres.findBy().any({ db: pool, params: { email: account.email } });
      expect(result?.accountId).toBe(account.accountId);
   });

   test("crud: select with WHERE", async () => {
      const idParam = param<{ id: string }>("id");
      const results = await Account.postgres.select({
         WHERE: sql`${Account.$accountId} = ${idParam}`,
      }).all({ db: pool, params: { id: account.accountId } });
      expect(results).toHaveLength(1);
      expect(results[0]!.accountId).toBe(account.accountId);
   });

   test("crud: update", async () => {
      const idParam = param<{ id: string }>("id");
      const updated = await Account.postgres.update({
         WHERE: sql`${Account.$accountId} = ${idParam}`,
      }).one({ db: pool, params: { set: { firstName: "Updated" }, id: account.accountId } });
      expect(updated.firstName).toBe("Updated");
      account = updated;
   });

   test("crud: upsert", async () => {
      const upserted = await Account.postgres.upsert({ CONFLICT_ON: [Account.$accountId] }).one({
         db: pool,
         params: { rows: [{ accountId: account.accountId, email: account.email, firstName: "Upserted", lastName: "Test" }] },
      });
      expect(upserted.accountId).toBe(account.accountId);
      expect(upserted.firstName).toBe("Upserted");
      account = upserted;
   });

   test("crud: delete", async () => {
      const deleted = await Account.postgres.delete({
         WHERE: sql`${Account.$accountId} = ${param<{ id: string }>("id")}`,
      }).all({ db: pool, params: { id: account.accountId } });
      expect(deleted).toHaveLength(1);
      expect(deleted[0]!.accountId).toBe(account.accountId);
   });
});

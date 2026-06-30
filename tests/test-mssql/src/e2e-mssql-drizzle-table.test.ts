
import { beforeAll, describe, expect, test } from "vitest";
import { ok } from "node:assert";
import { mssqlSchema, varchar, nvarchar } from "drizzle-orm/mssql-core";
import { fromDrizzleTable } from "@vexnor/drizzle/mssql";
import { insert, row, sql, param } from "@vexnor/core";
import "@vexnor/mssql";
import { pool } from "./mssql-pool.js";
import { getTag } from "./tags.js";

const schema = mssqlSchema("vexnor_dev");

const accountDrizzle = schema.table("account", {
   accountId: varchar("account_id", { length: 36 }).primaryKey().default("newid()"),
   parentId: varchar("parent_id", { length: 36 }),
   status: varchar("status", { length: 50 }).default("created"),
   email: varchar("email", { length: 255 }).notNull(),
   firstName: nvarchar("first_name", { length: 100 }).notNull(),
   lastName: nvarchar("last_name", { length: 100 }).notNull(),
   notes: nvarchar("notes", { length: "max" }),
});

const Account = fromDrizzleTable(accountDrizzle);

describe.sequential("e2e drizzle/mssql — fromDrizzleTable works against real DB", (ctx) => {
   const TAG = getTag(ctx);
   let account!: typeof accountDrizzle.$inferSelect;

   beforeAll(async () => {
      account = await Account.mssql.insertRows().one({
         db: pool.request(),
         params: { rows: [{ email: `${TAG}@example.com`, firstName: "Drizzle", lastName: "Test" }] },
      });
      ok(account, "account not inserted");
   });

   test("sql: insert and select", async () => {
      const inserted = await sql`
         INSERT INTO ${Account}
            (${insert.cols(Account, "rows")})
            OUTPUT ${row(Account.as("inserted").$$)}
            VALUES ${insert.values(Account, "rows")}
      `.mssql.one({ db: pool.request(), params: { rows: [{ email: `${TAG}-sql@example.com`, firstName: "SqlDrizzle", lastName: "Test" }] } });

      expect(inserted.email).toBe(`${TAG}-sql@example.com`);
      expect(inserted.firstName).toBe("SqlDrizzle");
      expect(inserted.accountId).toBeDefined();

      await sql`DELETE FROM ${Account} WHERE ${Account.$accountId} = ${inserted.accountId}`.mssql.run({ db: pool.request() });
   });

   test("crud: insertRows", async () => {
      expect(account.email).toBe(`${TAG}@example.com`);
      expect(account.firstName).toBe("Drizzle");
      expect(account.accountId).toBeDefined();
   });

   test("crud: select with WHERE", async () => {
      const idParam = param<{ id: string }>("id");
      const results = await Account.mssql.select({
         WHERE: sql`${Account.$accountId} = ${idParam}`,
      }).all({ db: pool.request(), params: { id: account.accountId } });
      expect(results).toHaveLength(1);
      expect(results[0]!.accountId.toLowerCase()).toBe(account.accountId.toLowerCase());
   });

   test("crud: update", async () => {
      const idParam = param<{ id: string }>("id");
      const updated = await Account.mssql.update({
         WHERE: sql`${Account.$accountId} = ${idParam}`,
      }).one({ db: pool.request(), params: { set: { firstName: "Updated" }, id: account.accountId } });
      expect(updated.firstName).toBe("Updated");
      account = updated;
   });

   test("crud: upsert", async () => {
      const upserted = await Account.mssql.upsert({ MERGE_ON: [Account.$accountId] }).one({
         db: pool.request(),
         params: { rows: [{ accountId: account.accountId, email: account.email, firstName: "Upserted", lastName: "Test" }] },
      });
      expect(upserted.accountId.toLowerCase()).toBe(account.accountId.toLowerCase());
      expect(upserted.firstName).toBe("Upserted");
      account = upserted;
   });

   test("crud: delete", async () => {
      const deleted = await Account.mssql.delete({
         WHERE: sql`${Account.$accountId} = ${param<{ id: string }>("id")}`,
      }).all({ db: pool.request(), params: { id: account.accountId } });
      expect(deleted).toHaveLength(1);
      expect(deleted[0]!.accountId.toLowerCase()).toBe(account.accountId.toLowerCase());
   });
});

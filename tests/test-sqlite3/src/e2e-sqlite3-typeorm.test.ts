import "reflect-metadata";
import { afterAll, beforeAll, describe, expect, test } from "vitest";
import { ok } from "node:assert";
import { randomUUID } from "node:crypto";
import { DataSource, EntitySchema, Entity, PrimaryColumn, Column, ViewEntity, ViewColumn } from "typeorm";
import { fromTypeORM } from "@vexnor/typeorm";
import { row, sql, param, excluded } from "vexnor";
import "@vexnor/sqlite3";
import { db, SQLITE_PATH } from "./config.js";

// ─── EntitySchema ─────────────────────────────────────────────────────────────

interface IAccount extends Record<string, unknown> {
   accountId: string;
   status: string;
   email: string;
   firstName: string;
   lastName: string;
   notes: string | null;
   createdAt: string;
   modifiedAt: string;
   parentId: string | null;
}

const AccountSchema = new EntitySchema<IAccount>({
   name: "TypeORMAccount",
   tableName: "account",
   schema: "main",
   columns: {
      accountId: { type: String, primary: true, name: "account_id" },
      status: { type: String, name: "status", nullable: false },
      email: { type: String, name: "email", nullable: false },
      firstName: { type: String, name: "first_name", nullable: false },
      lastName: { type: String, name: "last_name", nullable: false },
      notes: { type: String, name: "notes", nullable: true },
      createdAt: { type: String, name: "created_at", nullable: false },
      modifiedAt: { type: String, name: "modified_at", nullable: false },
      parentId: { type: String, name: "parent_id", nullable: true },
   },
});

// ─── Decorator entity ─────────────────────────────────────────────────────────

@Entity({ name: "account", schema: "main" })
class AccountEntity {
   @PrimaryColumn({ name: "account_id", type: String })
   accountId!: string;

   @Column({ name: "status", type: String })
   status!: string;

   @Column({ name: "email", type: String })
   email!: string;

   @Column({ name: "first_name", type: String })
   firstName!: string;

   @Column({ name: "last_name", type: String })
   lastName!: string;

   @Column({ name: "notes", type: String, nullable: true })
   notes!: string | null;

   @Column({ name: "created_at", type: String })
   createdAt!: string;

   @Column({ name: "modified_at", type: String })
   modifiedAt!: string;

   @Column({ name: "parent_id", type: String, nullable: true })
   parentId!: string | null;
}

// ─── View EntitySchema ────────────────────────────────────────────────────────

interface IAccountOrderSummary extends Record<string, unknown> {
   accountId: string;
   email: string;
   firstName: string;
   lastName: string;
   status: string;
   orderCount: number;
   latestOrderAt: string | null;
}

const AccountOrderSummarySchema = new EntitySchema<IAccountOrderSummary>({
   name: "TypeORMAccountOrderSummary",
   tableName: "account_order_summary",
   schema: "main",
   type: "view",
   columns: {
      accountId: { type: String, name: "account_id" },
      email: { type: String, name: "email" },
      firstName: { type: String, name: "first_name" },
      lastName: { type: String, name: "last_name" },
      status: { type: String, name: "status" },
      orderCount: { type: Number, name: "order_count" },
      latestOrderAt: { type: String, name: "latest_order_at", nullable: true },
   },
});

// ─── View decorator entity ────────────────────────────────────────────────────

@ViewEntity({ name: "account_order_summary", schema: "main" })
class AccountOrderSummaryEntity {
   @ViewColumn({ name: "account_id" })
   accountId!: string;

   @ViewColumn({ name: "email" })
   email!: string;

   @ViewColumn({ name: "first_name" })
   firstName!: string;

   @ViewColumn({ name: "last_name" })
   lastName!: string;

   @ViewColumn({ name: "status" })
   status!: string;

   @ViewColumn({ name: "order_count" })
   orderCount!: number;

   @ViewColumn({ name: "latest_order_at" })
   latestOrderAt!: string | null;
}

// ─── DataSource ───────────────────────────────────────────────────────────────

let dataSource: DataSource;

beforeAll(async () => {
   dataSource = new DataSource({
      type: "better-sqlite3",
      database: SQLITE_PATH,
      entities: [AccountSchema, AccountEntity, AccountOrderSummarySchema, AccountOrderSummaryEntity],
   });
   await dataSource.initialize();
});

afterAll(async () => {
   await dataSource.destroy();
});

// ─── EntitySchema tests ───────────────────────────────────────────────────────

describe.sequential("e2e typeorm/sqlite — EntitySchema", () => {
   const TAG = "typeorm-schema-e2e";
   let account!: IAccount;
   let Account: ReturnType<typeof fromTypeORM<IAccount>>;

   beforeAll(() => {
      Account = fromTypeORM(dataSource.getRepository(AccountSchema));
   });

   test("sql: insert and select", async () => {
      const accountId = randomUUID();
      await sql`
         INSERT INTO ${Account}
            ${Account.insertColsVals({ accountId, email: `${TAG}-sql@example.com`, firstName: "SqlTypeORM", lastName: "Test" })}
      `.sqlite.run({ db });

      const selected = await sql`
         SELECT ${row(Account.$$)} FROM ${Account}
         WHERE ${Account.$accountId} = ${accountId}
      `.sqlite.one({ db });

      expect(selected.email).toBe(`${TAG}-sql@example.com`);
      expect(selected.firstName).toBe("SqlTypeORM");

      await sql`DELETE FROM ${Account} WHERE ${Account.$accountId} = ${accountId}`.sqlite.run({ db });
   });

   test("crud: insertRows", async () => {
      account = await Account.sqlite.insertRows().one({
         db,
         params: { rows: [{ accountId: randomUUID(), email: `${TAG}@example.com`, firstName: "TypeORM", lastName: "Test" }] },
      });
      ok(account, "account not inserted");
      expect(account.email).toBe(`${TAG}@example.com`);
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
      const results = await Account.sqlite.select({
         WHERE: sql`${Account.$accountId} = ${idParam}`,
      }).all({ db, params: { id: account.accountId } });
      expect(results).toHaveLength(1);
      expect(results[0]!.accountId).toBe(account.accountId);
   });

   test("crud: update", async () => {
      const idParam = param<{ id: string }>("id");
      const updated = await Account.sqlite.update({
         WHERE: sql`${Account.$accountId} = ${idParam}`,
      }).one({ db, params: { set: { firstName: "Updated" }, id: account.accountId } });
      expect(updated.firstName).toBe("Updated");
      account = updated;
   });

   test("crud: upsert", async () => {
      const upserted = await Account.sqlite.upsert({ CONFLICT_ON: [Account.$accountId] }).one({
         db,
         params: { rows: [{ accountId: account.accountId, email: account.email, firstName: "Upserted", lastName: "Test" }] },
      });
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
            params: { rows: [{ accountId: account.accountId, email: account.email, firstName: "UpsertedCustom", lastName: "Test" }] },
         });
      expect(upserted.firstName).toBe("UpsertedCustom");
      account = upserted;
   });

   test("crud: delete", async () => {
      const deleted = await Account.sqlite.delete({
         WHERE: sql`${Account.$accountId} = ${param<{ id: string }>("id")}`,
      }).all({ db, params: { id: account.accountId } });
      expect(deleted).toHaveLength(1);
      expect(deleted[0]!.accountId).toBe(account.accountId);
   });
});

// ─── Decorator entity tests ───────────────────────────────────────────────────

describe.sequential("e2e typeorm/sqlite — decorator entity", () => {
   const TAG = "typeorm-decorator-e2e";
   let account!: AccountEntity;
   // eslint-disable-next-line @typescript-eslint/no-explicit-any
   let Account: ReturnType<typeof fromTypeORM<any>>;

   beforeAll(() => {
      Account = fromTypeORM(dataSource.getRepository(AccountEntity));
   });

   test("sql: insert and select", async () => {
      const accountId = randomUUID();
      await sql`
         INSERT INTO ${Account}
            ${Account.insertColsVals({ accountId, email: `${TAG}-sql@example.com`, firstName: "SqlDecorator", lastName: "Test" })}
      `.sqlite.run({ db });

      const selected = await sql`
         SELECT ${row(Account.$$)} FROM ${Account}
         WHERE ${Account.$accountId} = ${accountId}
      `.sqlite.one({ db });

      expect(selected.email).toBe(`${TAG}-sql@example.com`);
      expect(selected.firstName).toBe("SqlDecorator");

      await sql`DELETE FROM ${Account} WHERE ${Account.$accountId} = ${accountId}`.sqlite.run({ db });
   });

   test("crud: insertRows", async () => {
      account = await Account.sqlite.insertRows().one({
         db,
         params: { rows: [{ accountId: randomUUID(), email: `${TAG}@example.com`, firstName: "Decorator", lastName: "Test" }] },
      });
      ok(account, "account not inserted");
      expect(account.email).toBe(`${TAG}@example.com`);
      expect(account.accountId).toBeDefined();
   });

   test("crud: findById", async () => {
      const result = await Account.sqlite.findById().any({ db, params: { accountId: account.accountId } });
      expect(result?.accountId).toBe(account.accountId);
   });

   test("crud: update", async () => {
      const idParam = param<{ id: string }>("id");
      const updated = await Account.sqlite.update({
         WHERE: sql`${Account.$accountId} = ${idParam}`,
      }).one({ db, params: { set: { firstName: "Updated" }, id: account.accountId } });
      expect(updated.firstName).toBe("Updated");
      account = updated;
   });

   test("crud: delete", async () => {
      const deleted = await Account.sqlite.delete({
         WHERE: sql`${Account.$accountId} = ${param<{ id: string }>("id")}`,
      }).all({ db, params: { id: account.accountId } });
      expect(deleted).toHaveLength(1);
      expect(deleted[0]!.accountId).toBe(account.accountId);
   });
});

// ─── View tests ───────────────────────────────────────────────────────────────

describe("e2e typeorm/sqlite — view (EntitySchema)", () => {
   let View: ReturnType<typeof fromTypeORM<IAccountOrderSummary>>;

   beforeAll(() => {
      View = fromTypeORM(dataSource.getRepository(AccountOrderSummarySchema));
   });

   test("crud is select-only", () => {
      expect(View.crud).toMatchInlineSnapshot(`
        {
          "delete": false,
          "insert": false,
          "select": true,
          "update": false,
        }
      `);
   });

   test("SELECT all columns", async () => {
      const results = await sql`SELECT ${row(View.$$)} FROM ${View}`.sqlite.all({ db });
      expect(Array.isArray(results)).toBe(true);
   });

   test("SELECT with WHERE param", async () => {
      const emailParam = param<{ email: string }>("email");
      const results = await sql`
         SELECT ${row(View.$$)} FROM ${View}
         WHERE ${View.$email} = ${emailParam}
      `.sqlite.all({ db, params: { email: "nonexistent@example.com" } });
      expect(results).toHaveLength(0);
   });
});

describe("e2e typeorm/sqlite — view (decorator entity)", () => {
   let View: ReturnType<typeof fromTypeORM<AccountOrderSummaryEntity & Record<string, unknown>>>;

   beforeAll(() => {
      View = fromTypeORM(dataSource.getRepository(AccountOrderSummaryEntity));
   });

   test("crud is select-only", () => {
      expect(View.crud).toMatchInlineSnapshot(`
        {
          "delete": false,
          "insert": false,
          "select": true,
          "update": false,
        }
      `);
   });

   test("SELECT all columns", async () => {
      const results = await sql`SELECT ${row(View.$$)} FROM ${View}`.sqlite.all({ db });
      expect(Array.isArray(results)).toBe(true);
   });

   test("SELECT with WHERE param", async () => {
      const emailParam = param<{ email: string }>("email");
      const results = await sql`
         SELECT ${row(View.$$)} FROM ${View}
         WHERE ${View.$email} = ${emailParam}
      `.sqlite.all({ db, params: { email: "nonexistent@example.com" } });
      expect(results).toHaveLength(0);
   });
});

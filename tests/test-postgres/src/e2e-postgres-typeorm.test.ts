import "reflect-metadata";
import { afterAll, beforeAll, describe, expect, test } from "vitest";
import { ok } from "node:assert";
import { DataSource, EntitySchema, Entity, PrimaryGeneratedColumn, Column, ViewEntity, ViewColumn } from "typeorm";
import { fromTypeORM } from "@vexnor/typeorm";
import { row, sql, param, insert } from "@vexnor/core";
import "@vexnor/postgres";
import { pool } from "./postgres-pool.js";
import { POSTGRES_HOST, POSTGRES_PORT, POSTGRES_DATABASE, POSTGRES_USER, POSTGRES_PASSWORD } from "./config.js";

// ─── EntitySchema ─────────────────────────────────────────────────────────────

interface IAccount extends Record<string, unknown> {
   accountId: string;
   status: string;
   email: string;
   firstName: string;
   lastName: string;
   notes: string | null;
   createdAt: Date;
   modifiedAt: Date;
   parentId: string | null;
}

const AccountSchema = new EntitySchema<IAccount>({
   name: "TypeORMPgAccount",
   tableName: "account",
   schema: "vexnor_dev",
   columns: {
      accountId: { type: String, primary: true, name: "account_id", generated: "uuid" },
      status: { type: String, name: "status", nullable: false },
      email: { type: String, name: "email", nullable: false },
      firstName: { type: String, name: "first_name", nullable: false },
      lastName: { type: String, name: "last_name", nullable: false },
      notes: { type: String, name: "notes", nullable: true },
      createdAt: { type: Date, name: "created_at", nullable: false },
      modifiedAt: { type: Date, name: "modified_at", nullable: false },
      parentId: { type: String, name: "parent_id", nullable: true },
   },
});

// ─── Decorator entity ─────────────────────────────────────────────────────────

@Entity({ name: "account", schema: "vexnor_dev" })
class AccountEntity {
   @PrimaryGeneratedColumn("uuid", { name: "account_id" })
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

   @Column({ name: "created_at", type: Date })
   createdAt!: Date;

   @Column({ name: "modified_at", type: Date })
   modifiedAt!: Date;

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
   orderCount: string | null;
   latestOrderAt: Date | null;
}

const AccountOrderSummarySchema = new EntitySchema<IAccountOrderSummary>({
   name: "TypeORMPgAccountOrderSummary",
   tableName: "account_order_summary",
   schema: "vexnor_dev",
   type: "view",
   columns: {
      accountId: { type: String, name: "account_id" },
      email: { type: String, name: "email" },
      firstName: { type: String, name: "first_name" },
      lastName: { type: String, name: "last_name" },
      status: { type: String, name: "status" },
      orderCount: { type: String, name: "order_count", nullable: true },
      latestOrderAt: { type: Date, name: "latest_order_at", nullable: true },
   },
});

// ─── View decorator entity ────────────────────────────────────────────────────

@ViewEntity({ name: "account_order_summary", schema: "vexnor_dev" })
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
   orderCount!: string | null;

   @ViewColumn({ name: "latest_order_at" })
   latestOrderAt!: Date | null;
}

// ─── DataSource ───────────────────────────────────────────────────────────────

let dataSource: DataSource;

beforeAll(async () => {
   dataSource = new DataSource({
      type: "postgres",
      host: POSTGRES_HOST,
      port: POSTGRES_PORT,
      database: POSTGRES_DATABASE,
      username: POSTGRES_USER,
      password: POSTGRES_PASSWORD,
      entities: [AccountSchema, AccountEntity, AccountOrderSummarySchema, AccountOrderSummaryEntity],
   });
   await dataSource.initialize();
});

afterAll(async () => {
   await dataSource.destroy();
});

// ─── EntitySchema tests ───────────────────────────────────────────────────────

describe.sequential("e2e typeorm/pg — EntitySchema", () => {
   const TAG = "typeorm-schema-pg-e2e";
   let account!: IAccount;
   let Account: ReturnType<typeof fromTypeORM<IAccount>>;

   beforeAll(() => {
      Account = fromTypeORM(dataSource.getRepository(AccountSchema));
   });

   test("sql: insert and select", async () => {
      const inserted = await sql`
         INSERT INTO ${Account}
            ${insert(Account, "rows")}
            RETURNING ${row(Account.$$)}
      `.postgres.one({ db: pool, params: { rows: [{ email: `${TAG}-sql@example.com`, firstName: "SqlTypeORM", lastName: "Test" }] } });

      expect(inserted.email).toBe(`${TAG}-sql@example.com`);
      expect(inserted.firstName).toBe("SqlTypeORM");
      expect(inserted.accountId).toBeDefined();

      await sql`DELETE FROM ${Account} WHERE ${Account.$accountId} = ${inserted.accountId}`.postgres.run({ db: pool });
   });

   test("crud: insertRows", async () => {
      account = await Account.postgres.insertRows().one({
         db: pool,
         params: { rows: [{ email: `${TAG}@example.com`, firstName: "TypeORM", lastName: "Test" }] },
      });
      ok(account, "account not inserted");
      expect(account.email).toBe(`${TAG}@example.com`);
      expect(account.accountId).toBeDefined();
   });

   test("crud: select with WHERE", async () => {
      const idParam = param<{ id: string }>("id");
      const results = await Account.postgres
         .select({
            WHERE: sql`${Account.$accountId} = ${idParam}`,
         })
         .all({ db: pool, params: { id: account.accountId } });
      expect(results).toHaveLength(1);
      expect(results[0]!.accountId).toBe(account.accountId);
   });

   test("crud: update", async () => {
      const idParam = param<{ id: string }>("id");
      const updated = await Account.postgres
         .update({
            WHERE: sql`${Account.$accountId} = ${idParam}`,
         })
         .one({ db: pool, params: { set: { firstName: "Updated" }, id: account.accountId } });
      expect(updated.firstName).toBe("Updated");
      account = updated;
   });

   test("crud: upsert", async () => {
      const upserted = await Account.postgres.upsert({ CONFLICT_ON: [Account.$accountId] }).one({
         db: pool,
         params: {
            rows: [{ accountId: account.accountId, email: account.email, firstName: "Upserted", lastName: "Test" }],
         },
      });
      expect(upserted.accountId).toBe(account.accountId);
      expect(upserted.firstName).toBe("Upserted");
      account = upserted;
   });

   test("crud: delete", async () => {
      const deleted = await Account.postgres
         .delete({
            WHERE: sql`${Account.$accountId} = ${param<{ id: string }>("id")}`,
         })
         .all({ db: pool, params: { id: account.accountId } });
      expect(deleted).toHaveLength(1);
      expect(deleted[0]!.accountId).toBe(account.accountId);
   });
});

// ─── Decorator entity tests ───────────────────────────────────────────────────

describe.sequential("e2e typeorm/pg — decorator entity", () => {
   const TAG = "typeorm-decorator-pg-e2e";
   let account!: AccountEntity;
   // eslint-disable-next-line @typescript-eslint/no-explicit-any
   let Account: ReturnType<typeof fromTypeORM<any>>;

   beforeAll(() => {
      Account = fromTypeORM(dataSource.getRepository(AccountEntity));
   });

   test("sql: insert and select", async () => {
      const inserted = await sql`
         INSERT INTO ${Account}
            ${insert(Account, "rows")}
            RETURNING ${row(Account.$$)}
      `.postgres.one({ db: pool, params: { rows: [{ email: `${TAG}-sql@example.com`, firstName: "SqlDecorator", lastName: "Test" }] } });

      expect(inserted.email).toBe(`${TAG}-sql@example.com`);
      expect(inserted.firstName).toBe("SqlDecorator");

      await sql`DELETE FROM ${Account} WHERE ${Account.$accountId} = ${inserted.accountId}`.postgres.run({ db: pool });
   });

   test("crud: insertRows", async () => {
      account = await Account.postgres.insertRows().one({
         db: pool,
         params: { rows: [{ email: `${TAG}@example.com`, firstName: "Decorator", lastName: "Test" }] },
      });
      ok(account, "account not inserted");
      expect(account.email).toBe(`${TAG}@example.com`);
      expect(account.accountId).toBeDefined();
   });

   test("crud: update", async () => {
      const idParam = param<{ id: string }>("id");
      const updated = await Account.postgres
         .update({
            WHERE: sql`${Account.$accountId} = ${idParam}`,
         })
         .one({ db: pool, params: { set: { firstName: "Updated" }, id: account.accountId } });
      expect(updated.firstName).toBe("Updated");
      account = updated;
   });

   test("crud: upsert with custom SET", async () => {
      const upserted = await Account.postgres
         .upsert({
            CONFLICT_ON: [Account.$accountId!],
         })
         .one({
            db: pool,
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
      const deleted = await Account.postgres
         .delete({
            WHERE: sql`${Account.$accountId} = ${param<{ id: string }>("id")}`,
         })
         .all({ db: pool, params: { id: account.accountId } });
      expect(deleted).toHaveLength(1);
      expect(deleted[0]!.accountId).toBe(account.accountId);
   });
});

// ─── View tests ───────────────────────────────────────────────────────────────

describe("e2e typeorm/pg — view (EntitySchema)", () => {
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
      const results = await sql`SELECT ${row(View.$$)} FROM ${View}`.postgres.all({ db: pool });
      expect(Array.isArray(results)).toBe(true);
   });

   test("SELECT with WHERE param", async () => {
      const emailParam = param<{ email: string }>("email");
      const results = await sql`
         SELECT ${row(View.$$)} FROM ${View}
         WHERE ${View.$email} = ${emailParam}
      `.postgres.all({ db: pool, params: { email: "nonexistent@example.com" } });
      expect(results).toHaveLength(0);
   });
});

describe("e2e typeorm/pg — view (decorator entity)", () => {
   // eslint-disable-next-line @typescript-eslint/no-explicit-any
   let View: ReturnType<typeof fromTypeORM<any>>;

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
      const results = await sql`SELECT ${row(View.$$)} FROM ${View}`.postgres.all({ db: pool });
      expect(Array.isArray(results)).toBe(true);
   });

   test("SELECT with WHERE param", async () => {
      const emailParam = param<{ email: string }>("email");
      const results = await sql`
         SELECT ${row(View.$$)} FROM ${View}
         WHERE ${View.$email} = ${emailParam}
      `.postgres.all({ db: pool, params: { email: "nonexistent@example.com" } });
      expect(results).toHaveLength(0);
   });
});

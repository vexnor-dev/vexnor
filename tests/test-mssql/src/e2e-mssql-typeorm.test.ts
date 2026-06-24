import "reflect-metadata";
import { afterAll, beforeAll, describe, expect, test } from "vitest";
import { ok } from "node:assert";
import { DataSource, EntitySchema, Entity, PrimaryGeneratedColumn, Column, ViewEntity, ViewColumn } from "typeorm";
import { fromTypeORM } from "@vexnor/typeorm";
import { insert, row, sql, param } from "@vexnor/core";
import "@vexnor/mssql";
import { pool } from "./mssql-pool.js";
import { getTag } from "./tags.js";
import { MSSQL_HOST, MSSQL_PORT, MSSQL_DATABASE, MSSQL_USER, MSSQL_PASSWORD } from "./config.js";

// ─── EntitySchema ─────────────────────────────────────────────────────────────

interface IAccount extends Record<string, unknown> {
   accountId: string;
   parentId: string | null;
   status: string;
   email: string;
   firstName: string;
   lastName: string;
   notes: string | null;
   createdAt: Date;
   modifiedAt: Date;
}

const AccountSchema = new EntitySchema<IAccount>({
   name: "TypeORMMssqlAccount",
   tableName: "account",
   schema: "vexnor_dev",
   columns: {
      accountId: { type: String, primary: true, name: "account_id", generated: "uuid" },
      parentId: { type: String, name: "parent_id", nullable: true },
      status: { type: String, name: "status", nullable: false },
      email: { type: String, name: "email", nullable: false },
      firstName: { type: String, name: "first_name", nullable: false },
      lastName: { type: String, name: "last_name", nullable: false },
      notes: { type: String, name: "notes", nullable: true },
      createdAt: { type: Date, name: "created_at", nullable: false },
      modifiedAt: { type: Date, name: "modified_at", nullable: false },
   },
});

// ─── Decorator entity ─────────────────────────────────────────────────────────

@Entity({ name: "account", schema: "vexnor_dev" })
class AccountEntity {
   @PrimaryGeneratedColumn("uuid", { name: "account_id" })
   accountId!: string;

   @Column({ name: "parent_id", type: String, nullable: true })
   parentId!: string | null;

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
}

// ─── View EntitySchema ────────────────────────────────────────────────────────

interface IAccountOrderSummary extends Record<string, unknown> {
   accountId: string;
   email: string;
   firstName: string;
   lastName: string;
   status: string;
   orderCount: number | null;
   latestOrderAt: Date | null;
}

const AccountOrderSummarySchema = new EntitySchema<IAccountOrderSummary>({
   name: "TypeORMMssqlAccountOrderSummary",
   tableName: "account_order_summary",
   schema: "vexnor_dev",
   type: "view",
   columns: {
      accountId: { type: String, name: "account_id" },
      email: { type: String, name: "email" },
      firstName: { type: String, name: "first_name" },
      lastName: { type: String, name: "last_name" },
      status: { type: String, name: "status" },
      orderCount: { type: Number, name: "order_count", nullable: true },
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
   orderCount!: number | null;

   @ViewColumn({ name: "latest_order_at" })
   latestOrderAt!: Date | null;
}

// ─── DataSource ───────────────────────────────────────────────────────────────

let dataSource: DataSource;

beforeAll(async () => {
   dataSource = new DataSource({
      type: "mssql",
      host: MSSQL_HOST,
      port: MSSQL_PORT,
      database: MSSQL_DATABASE,
      username: MSSQL_USER,
      password: MSSQL_PASSWORD,
      options: { trustServerCertificate: true },
      entities: [AccountSchema, AccountEntity, AccountOrderSummarySchema, AccountOrderSummaryEntity],
   });
   await dataSource.initialize();
});

afterAll(async () => {
   await dataSource.destroy();
});

// ─── EntitySchema tests ───────────────────────────────────────────────────────

describe.sequential("e2e typeorm/mssql — EntitySchema", (ctx) => {
   const TAG = getTag(ctx);
   let account!: IAccount;
   let Account: ReturnType<typeof fromTypeORM<IAccount>>;

   beforeAll(() => {
      Account = fromTypeORM(dataSource.getRepository(AccountSchema));
   });

   test("sql: insert and select", async () => {
      const inserted = await sql`
         INSERT INTO ${Account}
            (${insert.cols(Account, "rows")})
            OUTPUT ${row(Account.as("inserted").$$)}
            VALUES ${insert.values(Account, "rows")}
      `.mssql.one({ db: pool.request(), params: { rows: [{ email: `${TAG}-sql@example.com`, firstName: "SqlTypeORM", lastName: "Test" }] } });

      expect(inserted.email).toBe(`${TAG}-sql@example.com`);
      expect(inserted.firstName).toBe("SqlTypeORM");
      expect(inserted.accountId).toBeDefined();

      await sql`DELETE FROM ${Account} WHERE ${Account.$accountId} = ${inserted.accountId}`.mssql.run({
         db: pool.request(),
      });
   });

   test("crud: insertRows", async () => {
      account = await Account.mssql.insertRows().one({
         db: pool.request(),
         params: { rows: [{ email: `${TAG}@example.com`, firstName: "TypeORM", lastName: "Test" }] },
      });
      ok(account, "account not inserted");
      expect(account.email).toBe(`${TAG}@example.com`);
      expect(account.accountId).toBeDefined();
   });

   test("crud: select with WHERE", async () => {
      const idParam = param<{ id: string }>("id");
      const results = await Account.mssql
         .select({
            WHERE: sql`${Account.$accountId} = ${idParam}`,
         })
         .all({ db: pool.request(), params: { id: account.accountId } });
      expect(results).toHaveLength(1);
      expect(results[0]!.accountId.toLowerCase()).toBe(account.accountId.toLowerCase());
   });

   test("crud: update", async () => {
      const idParam = param<{ id: string }>("id");
      const updated = await Account.mssql
         .update({
            WHERE: sql`${Account.$accountId} = ${idParam}`,
         })
         .one({ db: pool.request(), params: { set: { firstName: "Updated" }, id: account.accountId } });
      expect(updated.firstName).toBe("Updated");
      account = updated;
   });

   test("crud: upsert", async () => {
      const upserted = await Account.mssql.upsert({ MERGE_ON: [Account.$accountId] }).one({
         db: pool.request(),
         params: {
            rows: [{ accountId: account.accountId, email: account.email, firstName: "Upserted", lastName: "Test" }],
         },
      });
      expect(upserted.accountId.toLowerCase()).toBe(account.accountId.toLowerCase());
      expect(upserted.firstName).toBe("Upserted");
      account = upserted;
   });

   test("crud: delete", async () => {
      const deleted = await Account.mssql
         .delete({
            WHERE: sql`${Account.$accountId} = ${param<{ id: string }>("id")}`,
         })
         .all({ db: pool.request(), params: { id: account.accountId } });
      expect(deleted).toHaveLength(1);
      expect(deleted[0]!.accountId.toLowerCase()).toBe(account.accountId.toLowerCase());
   });
});

// ─── Decorator entity tests ───────────────────────────────────────────────────

describe.sequential("e2e typeorm/mssql — decorator entity", (ctx) => {
   const TAG = getTag(ctx);
   let account!: AccountEntity;
   // eslint-disable-next-line @typescript-eslint/no-explicit-any
   let Account: ReturnType<typeof fromTypeORM<any>>;

   beforeAll(() => {
      Account = fromTypeORM(dataSource.getRepository(AccountEntity));
   });

   test("sql: insert and select", async () => {
      const inserted = await sql`
         INSERT INTO ${Account}
            (${insert.cols(Account, "rows")})
            OUTPUT ${row(Account.as("inserted").$$)}
            VALUES ${insert.values(Account, "rows")}
      `.mssql.one({ db: pool.request(), params: { rows: [{ email: `${TAG}-sql@example.com`, firstName: "SqlDecorator", lastName: "Test" }] } });

      expect(inserted.email).toBe(`${TAG}-sql@example.com`);
      expect(inserted.firstName).toBe("SqlDecorator");

      await sql`DELETE FROM ${Account} WHERE ${Account.$accountId} = ${inserted.accountId}`.mssql.run({
         db: pool.request(),
      });
   });

   test("crud: insertRows", async () => {
      account = await Account.mssql.insertRows().one({
         db: pool.request(),
         params: { rows: [{ email: `${TAG}@example.com`, firstName: "Decorator", lastName: "Test" }] },
      });
      ok(account, "account not inserted");
      expect(account.email).toBe(`${TAG}@example.com`);
      expect(account.accountId).toBeDefined();
   });

   test("crud: update", async () => {
      const idParam = param<{ id: string }>("id");
      const updated = await Account.mssql
         .update({
            WHERE: sql`${Account.$accountId} = ${idParam}`,
         })
         .one({ db: pool.request(), params: { set: { firstName: "Updated" }, id: account.accountId } });
      expect(updated.firstName).toBe("Updated");
      account = updated;
   });

   test("crud: delete", async () => {
      const deleted = await Account.mssql
         .delete({
            WHERE: sql`${Account.$accountId} = ${param<{ id: string }>("id")}`,
         })
         .all({ db: pool.request(), params: { id: account.accountId } });
      expect(deleted).toHaveLength(1);
      expect(deleted[0]!.accountId.toLowerCase()).toBe(account.accountId.toLowerCase());
   });
});

// ─── View tests ───────────────────────────────────────────────────────────────

describe("e2e typeorm/mssql — view (EntitySchema)", () => {
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
      const results = await sql`SELECT ${row(View.$$)} FROM ${View}`.mssql.all({ db: pool.request() });
      expect(Array.isArray(results)).toBe(true);
   });

   test("SELECT with WHERE param", async () => {
      const emailParam = param<{ email: string }>("email");
      const results = await sql`
         SELECT ${row(View.$$)} FROM ${View}
         WHERE ${View.$email} = ${emailParam}
      `.mssql.all({ db: pool.request(), params: { email: "nonexistent@example.com" } });
      expect(results).toHaveLength(0);
   });
});

describe("e2e typeorm/mssql — view (decorator entity)", () => {
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
      const results = await sql`SELECT ${row(View.$$)} FROM ${View}`.mssql.all({ db: pool.request() });
      expect(Array.isArray(results)).toBe(true);
   });

   test("SELECT with WHERE param", async () => {
      const emailParam = param<{ email: string }>("email");
      const results = await sql`
         SELECT ${row(View.$$)} FROM ${View}
         WHERE ${View.$email} = ${emailParam}
      `.mssql.all({ db: pool.request(), params: { email: "nonexistent@example.com" } });
      expect(results).toHaveLength(0);
   });
});

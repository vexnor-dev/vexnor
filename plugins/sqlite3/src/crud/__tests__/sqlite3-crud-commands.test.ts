// noinspection SqlNoDataSourceInspection,SqlResolve
/**
 * These tests replicate the exact same test logic from the old function-based tests
 * (sqlite3-update.test.ts, sqlite3-delete.test.ts, sqlite3-upsert.test.ts) but using
 * the class-based commands. The SQL output must be byte-for-byte identical.
 */
import { describe, expect, test } from "vitest";
import "@vexnor/sqlite3";
import { Account } from "@vexnor/core/testing";
import { sql, input, param } from "@vexnor/core";
import { Sqlite3UpdateCommand } from "#src/crud/sqlite3-update-command.js";
import { Sqlite3DeleteCommand } from "#src/crud/sqlite3-delete-command.js";
import { Sqlite3InsertRowsCommand } from "#src/crud/sqlite3-insert-rows-command.js";
import { Sqlite3InsertFromCommand } from "#src/crud/sqlite3-insert-from-command.js";
import { Sqlite3UpsertCommand } from "#src/crud/sqlite3-upsert-command.js";
import { defaultQueryOptions } from "#src/crud/default-query-options.js";

// ─── Sqlite3UpdateCommand — mirrors sqlite3-update.test.ts ───────────────────

describe("Sqlite3UpdateCommand", () => {
   test("basic update", () => {
      const handler = new Sqlite3UpdateCommand(Account, {}).execute();
      const { text, values } = handler.source.getSql({
         params: { set: { email: "new@b.com" } },
         options: defaultQueryOptions,
      });
      expect(text).toMatchInlineSnapshot(`
        "/* <query_0> */
        /* driver: sqlite */
        UPDATE "main"."account"
        SET
          "email" = ?
        RETURNING
          "account"."account_id" AS "accountId",
          "account"."status",
          "account"."email",
          "account"."first_name" AS "firstName",
          "account"."last_name" AS "lastName",
          "account"."notes",
          "account"."created_at" AS "createdAt",
          "account"."modified_at" AS "modifiedAt",
          "account"."parent_id" AS "parentId"
          /* </query_0> */"
      `);
      expect(values).toMatchObject(["new@b.com"]);
   });

   test("with WHERE", () => {
      const params = input<{ id: string }>();
      const handler = new Sqlite3UpdateCommand(Account, { WHERE: sql`${Account.$accountId} = ${params.$id}` }).execute();
      const { text } = handler.source.getSql({
         params: { set: { email: "new@b.com" }, id: "test-id" },
         options: defaultQueryOptions,
      });
      expect(text).toMatchInlineSnapshot(`
        "/* <query_0> */
        /* driver: sqlite */
        UPDATE "main"."account"
        SET
          "email" = ?
          /* <query_1> */
        WHERE
          /* <query_2> */
          "account"."account_id" = ? /* </query_2> */ /* </query_1> */
        RETURNING
          "account"."account_id" AS "accountId",
          "account"."status",
          "account"."email",
          "account"."first_name" AS "firstName",
          "account"."last_name" AS "lastName",
          "account"."notes",
          "account"."created_at" AS "createdAt",
          "account"."modified_at" AS "modifiedAt",
          "account"."parent_id" AS "parentId"
          /* </query_0> */"
      `);
   });

   test("has $$ and row", () => {
      const handler = new Sqlite3UpdateCommand(Account, {}).execute();
      expect(handler.source.$$).toBeDefined();
      expect(handler.source.row).toBeDefined();
      expect(handler.source.row.$accountId).toBeDefined();
   });
});

// ─── Sqlite3DeleteCommand — mirrors sqlite3-delete.test.ts ───────────────────

describe("Sqlite3DeleteCommand", () => {
   test("throws without WHERE or force", () => {
      expect(() =>
         new Sqlite3DeleteCommand(Account, {
            // @ts-expect-error force must be true
            force: false,
         }),
      ).toThrow();
   });

   test("with force", () => {
      const handler = new Sqlite3DeleteCommand(Account, { force: true }).execute();
      const { text } = handler.source.getSql({ options: defaultQueryOptions });
      expect(text).toMatchInlineSnapshot(`
        "/* <query_0> */
        /* driver: sqlite */
        DELETE FROM "main"."account"
        RETURNING
          "account"."account_id" AS "accountId",
          "account"."status",
          "account"."email",
          "account"."first_name" AS "firstName",
          "account"."last_name" AS "lastName",
          "account"."notes",
          "account"."created_at" AS "createdAt",
          "account"."modified_at" AS "modifiedAt",
          "account"."parent_id" AS "parentId"
          /* </query_0> */"
      `);
   });

   test("with WHERE", () => {
      const id = param<{ id: string }>("id");
      const handler = new Sqlite3DeleteCommand(Account, { WHERE: sql`${Account.$accountId} = ${id}` }).execute();
      const { text } = handler.source.getSql({ params: { id: "test-id" }, options: defaultQueryOptions });
      expect(text).toMatchInlineSnapshot(`
        "/* <query_0> */
        /* driver: sqlite */
        DELETE FROM "main"."account"
        /* <query_1> */
        WHERE
          /* <query_2> */ "account"."account_id" = ? /* </query_2> */ /* </query_1> */
        RETURNING
          "account"."account_id" AS "accountId",
          "account"."status",
          "account"."email",
          "account"."first_name" AS "firstName",
          "account"."last_name" AS "lastName",
          "account"."notes",
          "account"."created_at" AS "createdAt",
          "account"."modified_at" AS "modifiedAt",
          "account"."parent_id" AS "parentId"
          /* </query_0> */"
      `);
   });

   test("has $$ and row", () => {
      const handler = new Sqlite3DeleteCommand(Account, { force: true }).execute();
      expect(handler.source.$$).toBeDefined();
      expect(handler.source.row).toBeDefined();
      expect(handler.source.row.$accountId).toBeDefined();
   });
});

// ─── Sqlite3InsertRowsCommand — no old test file exists, new coverage ────────

describe("Sqlite3InsertRowsCommand", () => {
   test("execute() returns handler with $$ and row", () => {
      const handler = new Sqlite3InsertRowsCommand(Account).execute();
      expect(handler.source.$$).toBeDefined();
      expect(handler.source.row).toBeDefined();
      expect(handler.source.row.$accountId).toBeDefined();
   });

   test("produces INSERT with RETURNING", () => {
      const handler = new Sqlite3InsertRowsCommand(Account).execute();
      const { text, values } = handler.source.getSql({
         params: { rows: [{ email: "a@b.com", firstName: "A", lastName: "B", status: "created" }] },
         options: defaultQueryOptions,
      });
      expect(text).toMatchInlineSnapshot(`
        "/* <query_0> */
        /* driver: sqlite */
        INSERT INTO
          "main"."account" ("status", "email", "first_name", "last_name")
        VALUES
          (?, ?, ?, ?)
        RETURNING
          "account"."account_id" AS "accountId",
          "account"."status",
          "account"."email",
          "account"."first_name" AS "firstName",
          "account"."last_name" AS "lastName",
          "account"."notes",
          "account"."created_at" AS "createdAt",
          "account"."modified_at" AS "modifiedAt",
          "account"."parent_id" AS "parentId"
          /* </query_0> */"
      `);
      expect(values).toMatchInlineSnapshot(`
        [
          "created",
          "a@b.com",
          "A",
          "B",
        ]
      `);
   });
});

// ─── Sqlite3InsertFromCommand — no old test file exists, new coverage ────────

describe("Sqlite3InsertFromCommand", () => {
   test("throws without FROM arg", () => {
      expect(() => new Sqlite3InsertFromCommand(Account, {} as never)).toThrow("Args 'FROM' is required");
   });

   test("execute() returns handler with source", () => {
      const from = sql`select ${Account.$email}, ${Account.$firstName} from ${Account}`;
      const handler = new Sqlite3InsertFromCommand(Account, { FROM: from as never }).execute();
      expect(handler).toBeDefined();
      expect(handler.source).toBeDefined();
   });

   test("produces INSERT FROM with RETURNING", () => {
      const from = sql`select ${Account.$email}, ${Account.$firstName} from ${Account}`;
      const handler = new Sqlite3InsertFromCommand(Account, { FROM: from as never }).execute();
      const { text } = handler.source.getSql({ options: defaultQueryOptions });
      expect(text).toMatchInlineSnapshot(`
        "/* <query_0> */
        /* driver: sqlite */
        INSERT INTO
          "main"."account"
          /* <query_1> */
        SELECT
          "a_1"."email",
          "a_1"."first_name" AS "firstName"
        FROM
          "main"."account" AS "a_1" /* </query_1> */
        RETURNING
          "account"."account_id" AS "accountId",
          "account"."status",
          "account"."email",
          "account"."first_name" AS "firstName",
          "account"."last_name" AS "lastName",
          "account"."notes",
          "account"."created_at" AS "createdAt",
          "account"."modified_at" AS "modifiedAt",
          "account"."parent_id" AS "parentId"
          /* </query_0> */"
      `);
   });
});

// ─── Sqlite3UpsertCommand — mirrors sqlite3-upsert.test.ts ──────────────────

describe("Sqlite3UpsertCommand", () => {
   test("auto SET: generates col = EXCLUDED.col for all non-conflict columns", () => {
      const handler = new Sqlite3UpsertCommand(Account, { CONFLICT_ON: [Account.$accountId] }).execute();
      const { text, values } = handler.source.getSql({
         params: { rows: [{ accountId: "id-1", email: "a@b.com", firstName: "John", lastName: "Doe" }] },
         options: defaultQueryOptions,
      });
      expect(text).toMatchInlineSnapshot(`
        "/* <query_0> */
        /* driver: sqlite */
        INSERT INTO
          "main"."account" ("account_id", "email", "first_name", "last_name")
        VALUES
          (?, ?, ?, ?)
        ON CONFLICT ("account_id") DO UPDATE
        SET
          "email" = excluded."email",
          "first_name" = excluded."first_name",
          "last_name" = excluded."last_name"
        RETURNING
          "account"."account_id" AS "accountId",
          "account"."status",
          "account"."email",
          "account"."first_name" AS "firstName",
          "account"."last_name" AS "lastName",
          "account"."notes",
          "account"."created_at" AS "createdAt",
          "account"."modified_at" AS "modifiedAt",
          "account"."parent_id" AS "parentId"
          /* </query_0> */"
      `);
      expect(values).toMatchInlineSnapshot(`
        [
          "id-1",
          "a@b.com",
          "John",
          "Doe",
        ]
      `);
   });

   test("batch upsert: multiple rows", () => {
      const handler = new Sqlite3UpsertCommand(Account, { CONFLICT_ON: [Account.$accountId] }).execute();
      const { text, values } = handler.source.getSql({
         params: {
            rows: [
               { accountId: "id-1", email: "a@b.com", firstName: "John", lastName: "Doe" },
               { accountId: "id-2", email: "b@b.com", firstName: "Jane", lastName: "Smith" },
            ],
         },
         options: defaultQueryOptions,
      });
      expect(text).toMatchInlineSnapshot(`
        "/* <query_0> */
        /* driver: sqlite */
        INSERT INTO
          "main"."account" ("account_id", "email", "first_name", "last_name")
        VALUES
          (?, ?, ?, ?),
          (?, ?, ?, ?)
        ON CONFLICT ("account_id") DO UPDATE
        SET
          "email" = excluded."email",
          "first_name" = excluded."first_name",
          "last_name" = excluded."last_name"
        RETURNING
          "account"."account_id" AS "accountId",
          "account"."status",
          "account"."email",
          "account"."first_name" AS "firstName",
          "account"."last_name" AS "lastName",
          "account"."notes",
          "account"."created_at" AS "createdAt",
          "account"."modified_at" AS "modifiedAt",
          "account"."parent_id" AS "parentId"
          /* </query_0> */"
      `);
      expect(values).toMatchInlineSnapshot(`
        [
          "id-1",
          "a@b.com",
          "John",
          "Doe",
          "id-2",
          "b@b.com",
          "Jane",
          "Smith",
        ]
      `);
   });
});

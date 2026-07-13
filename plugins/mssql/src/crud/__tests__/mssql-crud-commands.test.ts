// noinspection SqlNoDataSourceInspection,SqlResolve
/**
 * These tests replicate the exact same test logic from the old function-based tests
 * (mssql-update.test.ts, mssql-delete.test.ts, mssql-upsert.test.ts) but using
 * the class-based commands. The SQL output must be byte-for-byte identical.
 */
import { describe, expect, test } from "vitest";
import "@vexnor/mssql";
import { Account } from "@vexnor/core/testing";
import { sql, input, param } from "@vexnor/core";
import { MssqlUpdateCommand } from "#src/crud/mssql-update-command.js";
import { MssqlDeleteCommand } from "#src/crud/mssql-delete-command.js";
import { MssqlInsertRowsCommand } from "#src/crud/mssql-insert-rows-command.js";
import { MssqlInsertFromCommand } from "#src/crud/mssql-insert-from-command.js";
import { MssqlUpsertCommand } from "#src/crud/mssql-upsert-command.js";
import { defaultQueryOptions } from "#src/default-query-options.js";

// ─── MssqlUpdateCommand — mirrors mssql-update.test.ts ───────────────────────

describe("MssqlUpdateCommand", () => {
   test("basic update", () => {
      const handler = new MssqlUpdateCommand(Account, {}).execute();
      const { text, values } = handler.source.getSql({ params: { set: { email: "new@b.com" } }, options: defaultQueryOptions });
      expect(text).toMatchInlineSnapshot(`
        "/* <query_0> */
        /* driver: transactsql */
        UPDATE "main"."account"
        SET
          "email" = @param_0 output "inserted"."account_id" AS "accountId",
          "inserted"."status",
          "inserted"."email",
          "inserted"."first_name" AS "firstName",
          "inserted"."last_name" AS "lastName",
          "inserted"."notes",
          "inserted"."created_at" AS "createdAt",
          "inserted"."modified_at" AS "modifiedAt",
          "inserted"."parent_id" AS "parentId"
          /* </query_0> */"
      `);
      expect(values).toMatchObject(["new@b.com"]);
   });

   test("with WHERE", () => {
      const params = input<{ id: string }>();
      const handler = new MssqlUpdateCommand(Account, { WHERE: sql`${Account.$accountId} = ${params.$id}` }).execute();
      const { text } = handler.source.getSql({
         params: { set: { email: "new@b.com" }, id: "test-id" },
         options: defaultQueryOptions,
      });
      expect(text).toMatchInlineSnapshot(`
        "/* <query_0> */
        /* driver: transactsql */
        UPDATE "main"."account"
        SET
          "email" = @param_0 output "inserted"."account_id" AS "accountId",
          "inserted"."status",
          "inserted"."email",
          "inserted"."first_name" AS "firstName",
          "inserted"."last_name" AS "lastName",
          "inserted"."notes",
          "inserted"."created_at" AS "createdAt",
          "inserted"."modified_at" AS "modifiedAt",
          "inserted"."parent_id" AS "parentId"
          /* <query_1> */
        WHERE
          /* <query_2> */ "account"."account_id" = @param_1 /* </query_2> */ /* </query_1> */
          /* </query_0> */"
      `);
   });

   test("has $$ and row", () => {
      const handler = new MssqlUpdateCommand(Account, {}).execute();
      expect(handler.source.$$).toBeDefined();
      expect(handler.source.row).toBeDefined();
      expect(handler.source.row.$accountId).toBeDefined();
   });
});

// ─── MssqlDeleteCommand — mirrors mssql-delete.test.ts ───────────────────────

describe("MssqlDeleteCommand", () => {
   test("throws without WHERE or force", () => {
      expect(() =>
         new MssqlDeleteCommand(Account, {
            // @ts-expect-error force must be true
            force: false,
         }),
      ).toThrow();
   });

   test("with force", () => {
      const handler = new MssqlDeleteCommand(Account, { force: true }).execute();
      const { text } = handler.source.getSql({ options: defaultQueryOptions });
      expect(text).toMatchInlineSnapshot(`
        "/* <query_0> */
        /* driver: transactsql */
        DELETE FROM "main"."account" output "deleted"."account_id" AS "accountId",
        "deleted"."status",
        "deleted"."email",
        "deleted"."first_name" AS "firstName",
        "deleted"."last_name" AS "lastName",
        "deleted"."notes",
        "deleted"."created_at" AS "createdAt",
        "deleted"."modified_at" AS "modifiedAt",
        "deleted"."parent_id" AS "parentId"
        /* </query_0> */"
      `);
   });

   test("with WHERE", () => {
      const id = param<{ id: string }>("id");
      const handler = new MssqlDeleteCommand(Account, { WHERE: sql`${Account.$accountId} = ${id}` }).execute();
      const { text } = handler.source.getSql({ params: { id: "test-id" } });
      expect(text).toMatchInlineSnapshot(`
        "/* <query_0> */
        /* driver: transactsql */
        DELETE FROM "main"."account" output "deleted"."account_id" AS "accountId",
        "deleted"."status",
        "deleted"."email",
        "deleted"."first_name" AS "firstName",
        "deleted"."last_name" AS "lastName",
        "deleted"."notes",
        "deleted"."created_at" AS "createdAt",
        "deleted"."modified_at" AS "modifiedAt",
        "deleted"."parent_id" AS "parentId"
        /* <query_1> */
        WHERE
          /* <query_2> */ "account"."account_id" = ? /* </query_2> */ /* </query_1> */
          /* </query_0> */"
      `);
   });

   test("has $$ and row", () => {
      const handler = new MssqlDeleteCommand(Account, { force: true }).execute();
      expect(handler.source.$$).toBeDefined();
      expect(handler.source.row).toBeDefined();
      expect(handler.source.row.$accountId).toBeDefined();
   });
});

// ─── MssqlInsertRowsCommand — no old test file exists, new coverage ──────────

describe("MssqlInsertRowsCommand", () => {
   test("execute() returns handler with $$ and row", () => {
      const handler = new MssqlInsertRowsCommand(Account).execute();
      expect(handler.source.$$).toBeDefined();
      expect(handler.source.row).toBeDefined();
      expect(handler.source.row.$accountId).toBeDefined();
   });

   test("produces INSERT with OUTPUT inserted", () => {
      const handler = new MssqlInsertRowsCommand(Account).execute();
      const { text, values } = handler.source.getSql({
         params: { rows: [{ email: "a@b.com", firstName: "A", lastName: "B", status: "created" }] },
         options: defaultQueryOptions,
      });
      expect(text).toMatchInlineSnapshot(`
        "/* <query_0> */
        /* driver: transactsql */
        INSERT INTO
          "main"."account" ("status", "email", "first_name", "last_name") output "inserted"."account_id" AS "accountId",
          "inserted"."status",
          "inserted"."email",
          "inserted"."first_name" AS "firstName",
          "inserted"."last_name" AS "lastName",
          "inserted"."notes",
          "inserted"."created_at" AS "createdAt",
          "inserted"."modified_at" AS "modifiedAt",
          "inserted"."parent_id" AS "parentId"
        VALUES
          (@param_0, @param_1, @param_2, @param_3)
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

// ─── MssqlInsertFromCommand — no old test file exists, new coverage ──────────

describe("MssqlInsertFromCommand", () => {
   test("throws without FROM arg", () => {
      expect(() => new MssqlInsertFromCommand(Account, {} as never)).toThrow("Args 'FROM' is required");
   });

   test("execute() returns handler with source", () => {
      const from = sql`select ${Account.$email}, ${Account.$firstName} from ${Account}`;
      const handler = new MssqlInsertFromCommand(Account, { FROM: from as never }).execute();
      expect(handler).toBeDefined();
      expect(handler.source).toBeDefined();
   });

   test("produces INSERT FROM with OUTPUT inserted", () => {
      const from = sql`select ${Account.$email}, ${Account.$firstName} from ${Account}`;
      const handler = new MssqlInsertFromCommand(Account, { FROM: from as never }).execute();
      const { text } = handler.source.getSql({ options: defaultQueryOptions });
      expect(text).toMatchInlineSnapshot(`
        "/* <query_0> */
        /* driver: transactsql */
        INSERT INTO
          "main"."account"
          /* <query_1> */
        SELECT
          "a_1"."email",
          "a_1"."first_name" AS "firstName"
        FROM
          "main"."account" AS "a_1" /* </query_1> */ output "inserted"."account_id" AS "accountId",
          "inserted"."status",
          "inserted"."email",
          "inserted"."first_name" AS "firstName",
          "inserted"."last_name" AS "lastName",
          "inserted"."notes",
          "inserted"."created_at" AS "createdAt",
          "inserted"."modified_at" AS "modifiedAt",
          "inserted"."parent_id" AS "parentId"
          /* </query_0> */"
      `);
   });
});

// ─── MssqlUpsertCommand — mirrors mssql-upsert.test.ts ───────────────────────

describe("MssqlUpsertCommand", () => {
   test("auto SET: generates col = src.col for all non-merge columns", () => {
      const handler = new MssqlUpsertCommand(Account, { MERGE_ON: [Account.$accountId] }).execute();
      const { text, values } = handler.source.getSql({
         params: { rows: [{ accountId: "id-1", email: "a@b.com", firstName: "John", lastName: "Doe" }] },
         options: defaultQueryOptions,
      });
      expect(text).toMatchInlineSnapshot(`
        "/* <query_0> */
        /* driver: transactsql */
        MERGE INTO
          "main"."account" using (
            VALUES
              (@param_0, @param_1, @param_2, @param_3)
          ) AS src ("account_id", "email", "first_name", "last_name") ON ("account"."account_id" = src."account_id")
        WHEN MATCHED THEN
        UPDATE SET
          "email" = src."email",
          "first_name" = src."first_name",
          "last_name" = src."last_name"
        WHEN NOT MATCHED THEN
        INSERT
          ("account_id", "email", "first_name", "last_name")
        VALUES
          (
            src."account_id",
            src."email",
            src."first_name",
            src."last_name"
          ) output "inserted"."account_id" AS "accountId",
          "inserted"."status",
          "inserted"."email",
          "inserted"."first_name" AS "firstName",
          "inserted"."last_name" AS "lastName",
          "inserted"."notes",
          "inserted"."created_at" AS "createdAt",
          "inserted"."modified_at" AS "modifiedAt",
          "inserted"."parent_id" AS "parentId";

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
      const handler = new MssqlUpsertCommand(Account, { MERGE_ON: [Account.$accountId] }).execute();
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
        /* driver: transactsql */
        MERGE INTO
          "main"."account" using (
            VALUES
              (@param_0, @param_1, @param_2, @param_3),
              (@param_4, @param_5, @param_6, @param_7)
          ) AS src ("account_id", "email", "first_name", "last_name") ON ("account"."account_id" = src."account_id")
        WHEN MATCHED THEN
        UPDATE SET
          "email" = src."email",
          "first_name" = src."first_name",
          "last_name" = src."last_name"
        WHEN NOT MATCHED THEN
        INSERT
          ("account_id", "email", "first_name", "last_name")
        VALUES
          (
            src."account_id",
            src."email",
            src."first_name",
            src."last_name"
          ) output "inserted"."account_id" AS "accountId",
          "inserted"."status",
          "inserted"."email",
          "inserted"."first_name" AS "firstName",
          "inserted"."last_name" AS "lastName",
          "inserted"."notes",
          "inserted"."created_at" AS "createdAt",
          "inserted"."modified_at" AS "modifiedAt",
          "inserted"."parent_id" AS "parentId";

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

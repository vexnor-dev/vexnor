// noinspection SqlNoDataSourceInspection,SqlResolve
/**
 * These tests replicate the exact same test logic from the old function-based tests
 * (postgres-update.test.ts, postgres-delete.test.ts, postgres-upsert.test.ts) but using
 * the class-based commands. The SQL output must be byte-for-byte identical.
 */
import { describe, expect, test } from "vitest";
import "@vexnor/postgres";
import { Account } from "@vexnor/core/testing";
import { sql, input, param } from "@vexnor/core";
import { PostgresUpdateCommand } from "#src/crud/postgres-update-command.js";
import { PostgresDeleteCommand } from "#src/crud/postgres-delete-command.js";
import { PostgresInsertRowsCommand } from "#src/crud/postgres-insert-rows-command.js";
import { PostgresInsertFromCommand } from "#src/crud/postgres-insert-from-command.js";
import { PostgresUpsertCommand } from "#src/crud/postgres-upsert-command.js";
import { defaultQueryOptions } from "#src/default-query-options.js";

// ─── PostgresUpdateCommand — mirrors postgres-update.test.ts ─────────────────

describe("PostgresUpdateCommand", () => {
   test("basic update", () => {
      const handler = new PostgresUpdateCommand(Account, {}).execute();
      const { text, values } = handler.source.getSql({
         params: { set: { email: "new@b.com" } },
         options: defaultQueryOptions,
      });
      expect(text).toMatchInlineSnapshot(`
        "/* <query_0> */
        /* driver: postgres */
        UPDATE "main"."account"
        SET
          "email" = $1
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
      const handler = new PostgresUpdateCommand(Account, { WHERE: sql`${Account.$accountId} = ${params.$id}` }).execute();
      const { text } = handler.source.getSql({
         params: { set: { email: "new@b.com" }, id: "test-id" },
         options: defaultQueryOptions,
      });
      expect(text).toMatchInlineSnapshot(`
        "/* <query_0> */
        /* driver: postgres */
        UPDATE "main"."account"
        SET
          "email" = $1
          /* <query_1> */
        WHERE
          /* <query_2> */
          "account"."account_id" = $2 /* </query_2> */ /* </query_1> */
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
      const handler = new PostgresUpdateCommand(Account, {}).execute();
      expect(handler.source.$$).toBeDefined();
      expect(handler.source.row).toBeDefined();
      expect(handler.source.row.$accountId).toBeDefined();
   });
});

// ─── PostgresDeleteCommand — mirrors postgres-delete.test.ts ─────────────────

describe("PostgresDeleteCommand", () => {
   test("throws without WHERE or force", () => {
      expect(() =>
         new PostgresDeleteCommand(Account, {
            // @ts-expect-error force must be true
            force: false,
         }),
      ).toThrow();
   });

   test("with force", () => {
      const handler = new PostgresDeleteCommand(Account, { force: true }).execute();
      const { text } = handler.source.getSql({ options: defaultQueryOptions });
      expect(text).toMatchInlineSnapshot(`
        "/* <query_0> */
        /* driver: postgres */
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
      const handler = new PostgresDeleteCommand(Account, { WHERE: sql`${Account.$accountId} = ${id}` }).execute();
      const { text } = handler.source.getSql({ params: { id: "test-id" } });
      expect(text).toMatchInlineSnapshot(`
        "/* <query_0> */
        /* driver: postgres */
        DELETE FROM "main"."account"
        /* <query_1> */
        WHERE
          /* <query_2> */ "account"."account_id" = ? /* </query_2> */ /* </query_1> */ returning "account"."account_id" AS "accountId",
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
      const handler = new PostgresDeleteCommand(Account, { force: true }).execute();
      expect(handler.source.$$).toBeDefined();
      expect(handler.source.row).toBeDefined();
      expect(handler.source.row.$accountId).toBeDefined();
   });
});

// ─── PostgresInsertRowsCommand — no old test file exists, new coverage ───────

describe("PostgresInsertRowsCommand", () => {
   test("execute() returns handler with $$ and row", () => {
      const handler = new PostgresInsertRowsCommand(Account).execute();
      expect(handler.source.$$).toBeDefined();
      expect(handler.source.row).toBeDefined();
      expect(handler.source.row.$accountId).toBeDefined();
   });

   test("produces INSERT with RETURNING", () => {
      const handler = new PostgresInsertRowsCommand(Account).execute();
      const { text, values } = handler.source.getSql({
         params: { rows: [{ email: "a@b.com", firstName: "A", lastName: "B", status: "created" }] },
         options: defaultQueryOptions,
      });
      expect(text).toMatchInlineSnapshot(`
        "/* <query_0> */
        /* driver: postgres */
        INSERT INTO
          "main"."account" ("status", "email", "first_name", "last_name")
        VALUES
          ($1, $2, $3, $4)
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

// ─── PostgresInsertFromCommand — no old test file exists, new coverage ───────

describe("PostgresInsertFromCommand", () => {
   test("throws without FROM arg", () => {
      expect(() => new PostgresInsertFromCommand(Account, {} as any)).toThrow("Args 'FROM' is required");
   });

   test("execute() returns handler with source", () => {
      const from = sql`select ${Account.$email}, ${Account.$firstName} from ${Account}`;
      const handler = new PostgresInsertFromCommand(Account, { FROM: from as any }).execute();
      expect(handler).toBeDefined();
      expect(handler.source).toBeDefined();
   });

   test("produces INSERT FROM with RETURNING", () => {
      const from = sql`select ${Account.$email}, ${Account.$firstName} from ${Account}`;
      const handler = new PostgresInsertFromCommand(Account, { FROM: from as any }).execute();
      const { text } = handler.source.getSql({ options: defaultQueryOptions });
      expect(text).toMatchInlineSnapshot(`
        "/* <query_0> */
        /* driver: postgres */
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

// ─── PostgresUpsertCommand — mirrors postgres-upsert.test.ts ─────────────────

describe("PostgresUpsertCommand", () => {
   test("auto SET: generates col = EXCLUDED.col for all non-conflict columns", () => {
      const handler = new PostgresUpsertCommand(Account, { CONFLICT_ON: [Account.$accountId] }).execute();
      const { text, values } = handler.source.getSql({
         params: { rows: [{ accountId: "id-1", email: "a@b.com", firstName: "John", lastName: "Doe" }] },
         options: defaultQueryOptions,
      });
      expect(text).toMatchInlineSnapshot(`
        "/* <query_0> */
        /* driver: postgres */
        INSERT INTO
          "main"."account" ("account_id", "email", "first_name", "last_name")
        VALUES
          ($1, $2, $3, $4)
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
      const handler = new PostgresUpsertCommand(Account, { CONFLICT_ON: [Account.$accountId] }).execute();
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
        /* driver: postgres */
        INSERT INTO
          "main"."account" ("account_id", "email", "first_name", "last_name")
        VALUES
          ($1, $2, $3, $4),
          ($5, $6, $7, $8)
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

import { describe, expect, test } from "vitest";
import { newPostgresTableHandler } from "#/crud/postgres-table-handler.js";
import { Account } from "@vexnor/core/testing";
import { defaultQueryOptions } from "#/default-query-options.js";
import { param, sql } from "@vexnor/core";

describe("newPostgresTableHandler — SQL generation branches", () => {
   const handler = newPostgresTableHandler(Account);

   test("findBy() — multiple fields SQL", () => {
      const { text, values } = handler.findBy().source.getSql({
         params: { email: "a@b.com", firstName: "Jane" },
         options: defaultQueryOptions,
      });
      expect(text).toMatchInlineSnapshot(`
        "/* <query_0> */
        /* driver: postgres */
        SELECT
          "a_1"."account_id" AS "accountId",
          "a_1"."status",
          "a_1"."email",
          "a_1"."first_name" AS "firstName",
          "a_1"."last_name" AS "lastName",
          "a_1"."notes",
          "a_1"."created_at" AS "createdAt",
          "a_1"."modified_at" AS "modifiedAt",
          "a_1"."parent_id" AS "parentId"
        FROM
          "main"."account" AS "a_1"
          /* <query_1> */
        WHERE
          /* <query_2> */ /* <query_3> */ "a_1"."email" = $1 /* </query_3> */
          AND /* <query_4> */ "a_1"."first_name" = $2 /* </query_4> */ /* </query_2> */ /* </query_1> */
          /* </query_0> */"
      `);
      expect(values).toMatchInlineSnapshot(`
        [
          "a@b.com",
          "Jane",
        ]
      `);
   });

   test("findBy() — empty params produces no WHERE values", () => {
      const { text, values } = handler.findBy().source.getSql({
         params: {},
         options: defaultQueryOptions,
      });
      expect(text).toMatchInlineSnapshot(`
        "/* <query_0> */
        /* driver: postgres */
        SELECT
          "a_1"."account_id" AS "accountId",
          "a_1"."status",
          "a_1"."email",
          "a_1"."first_name" AS "firstName",
          "a_1"."last_name" AS "lastName",
          "a_1"."notes",
          "a_1"."created_at" AS "createdAt",
          "a_1"."modified_at" AS "modifiedAt",
          "a_1"."parent_id" AS "parentId"
        FROM
          "main"."account" AS "a_1"
          /* <query_1> */
        WHERE
          /* </query_1> */
          /* </query_0> */"
      `);
      expect(values).toMatchInlineSnapshot(`[]`);
   });

   test("select() — with WHERE clause", () => {
      const query = handler.select({
         WHERE: sql`${Account.$status} = ${param<{ status: string }>("status")}`,
      });
      const { text, values } = query.source.getSql({
         params: { status: "active" },
         options: defaultQueryOptions,
      });
      expect(text).toMatchInlineSnapshot(`
        "/* <query_0> */
        SELECT
          "a_1"."account_id" AS "accountId",
          "a_1"."status",
          "a_1"."email",
          "a_1"."first_name" AS "firstName",
          "a_1"."last_name" AS "lastName",
          "a_1"."notes",
          "a_1"."created_at" AS "createdAt",
          "a_1"."modified_at" AS "modifiedAt",
          "a_1"."parent_id" AS "parentId"
        FROM
          "main"."account" AS "a_1"
          /* <query_1> */
        WHERE
          /* <query_2> */ "a_1"."status" = $1 /* </query_2> */ /* </query_1> */
          /* </query_0> */"
      `);
      expect(values).toMatchInlineSnapshot(`
        [
          "active",
        ]
      `);
   });

   test("update() — with WHERE clause", () => {
      const query = handler.update({
         WHERE: sql`${Account.$accountId} = ${param<{ accountId: string }>("accountId")}`,
      });
      expect(query).toBeDefined();
      expect(query.source).toBeDefined();
   });

   test("delete() — with WHERE clause", () => {
      const query = handler.delete({
         WHERE: sql`${Account.$accountId} = ${param<{ accountId: string }>("accountId")}`,
      });
      const { text, values } = query.source.getSql({
         params: { accountId: "id-1" },
         options: defaultQueryOptions,
      });
      expect(text).toMatchInlineSnapshot(`
        "/* <query_0> */
        /* driver: postgres */
        DELETE FROM "main"."account"
        /* <query_1> */
        WHERE
          /* <query_2> */ "account"."account_id" = $1 /* </query_2> */ /* </query_1> */
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
        ]
      `);
   });

   test("insertRows() — SQL generation", () => {
      const { text } = handler.insertRows().source.getSql({
         params: {
            rows: [{ email: "test@test.com", firstName: "Test", lastName: "User" }],
         },
         options: defaultQueryOptions,
      });
      expect(text).toMatchInlineSnapshot(`
        "/* <query_0> */
        /* driver: postgres */
        INSERT INTO
          "main"."account" ("email", "first_name", "last_name")
        VALUES
          /* <query_1> */
          ($1, $2, $3) /* </query_1> */
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

   test("upsert() — SQL generation", () => {
      const query = handler.upsert({ CONFLICT_ON: [Account.$accountId] });
      const { text } = query.source.getSql({
         params: {
            rows: [{ email: "test@test.com", firstName: "Test", lastName: "User" }],
         },
         options: defaultQueryOptions,
      });
      expect(text).toMatchInlineSnapshot(`
        "/* <query_0> */
        /* driver: postgres */
        INSERT INTO
          "main"."account" ("email", "first_name", "last_name")
        VALUES
          /* <query_1> */
          ($1, $2, $3) /* </query_1> */
        ON CONFLICT ("account_id") DO UPDATE
        SET
          /* <query_2> */ /* <query_3> */ /* <query_4> */ "status" = EXCLUDED.status /* </query_4> */,
          /* <query_5> */ "email" = EXCLUDED.email /* </query_5> */,
          /* <query_6> */ "first_name" = EXCLUDED.first_name /* </query_6> */,
          /* <query_7> */ "last_name" = EXCLUDED.last_name /* </query_7> */,
          /* <query_8> */ "notes" = EXCLUDED.notes /* </query_8> */,
          /* <query_9> */ "created_at" = EXCLUDED.created_at /* </query_9> */,
          /* <query_10> */ "modified_at" = EXCLUDED.modified_at /* </query_10> */,
          /* <query_11> */ "parent_id" = EXCLUDED.parent_id /* </query_11> */ /* </query_3> */ /* </query_2> */
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

import { describe, expect, test } from "vitest";
import { newMssqlTableHandler } from "#/crud/mssql-table-handler.js";
import { Account } from "vexnor/testing";
import "@vexnor/mssql";
import { defaultQueryOptions } from "#/default-query-options.js";
import { param, sql } from "vexnor";

describe("newMssqlTableHandler — SQL generation branches", () => {
   const handler = newMssqlTableHandler(Account);

   test("findBy() — multiple fields SQL", () => {
      const { text, values } = handler.findBy().source.getSql({
         params: { email: "a@b.com", firstName: "Jane" },
         options: defaultQueryOptions,
      });
      expect(text).toMatchInlineSnapshot(`
        "/* <query_0> */
        /* driver: transactsql */
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
          /* <query_2> */ /* <query_3> */ "a_1"."email" = @param_0 /* </query_3> */
          AND /* <query_4> */ "a_1"."first_name" = @param_1 /* </query_4> */ /* </query_2> */ /* </query_1> */
          /* </query_0> */"
      `);
      expect(values).toMatchInlineSnapshot(`
        [
          "a@b.com",
          "Jane",
        ]
      `);
   });

   test("findBy() — empty params produces no WHERE clause values", () => {
      const { text, values } = handler.findBy().source.getSql({
         params: {},
         options: defaultQueryOptions,
      });
      expect(text).toMatchInlineSnapshot(`
        "/* <query_0> */
        /* driver: transactsql */
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
          /* <query_2> */ "a_1"."status" = @param_0 /* </query_2> */ /* </query_1> */
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
          /* <query_2> */ "account"."account_id" = @param_0 /* </query_2> */ /* </query_1> */
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
        /* driver: transactsql */
        INSERT INTO
          "main"."account" ("email", "first_name", "last_name") output "inserted"."account_id" AS "accountId",
          "inserted"."status",
          "inserted"."email",
          "inserted"."first_name" AS "firstName",
          "inserted"."last_name" AS "lastName",
          "inserted"."notes",
          "inserted"."created_at" AS "createdAt",
          "inserted"."modified_at" AS "modifiedAt",
          "inserted"."parent_id" AS "parentId"
        VALUES
          /* <query_1> */
          (@param_0, @param_1, @param_2) /* </query_1> */
          /* </query_0> */"
      `);
   });

   test("upsert() — SQL generation", () => {
      const query = handler.upsert({ MERGE_ON: [Account.$accountId] });
      const { text } = query.source.getSql({
         params: {
            rows: [{ email: "test@test.com", firstName: "Test", lastName: "User" }],
         },
         options: defaultQueryOptions,
      });
      expect(text).toMatchInlineSnapshot(`
        "/* <query_0> */
        /* driver: transactsql */
        MERGE INTO
          "main"."account" using (
            VALUES
              /* <query_1> */ (@param_0, @param_1, @param_2) /* </query_1> */
          ) AS src ("email", "first_name", "last_name") ON (
            /* <query_2> */ "account"."account_id" = src.account_id /* </query_2> */
          )
        WHEN MATCHED THEN
        UPDATE SET
          /* <query_3> */ /* <query_4> */ /* <query_5> */ "email" = src.email /* </query_5> */,
          /* <query_6> */ "first_name" = src.first_name /* </query_6> */,
          /* <query_7> */ "last_name" = src.last_name /* </query_7> */ /* </query_4> */ /* </query_3> */
        WHEN NOT MATCHED THEN
        INSERT
          ("email", "first_name", "last_name")
        VALUES
          (src.email, src.first_name, src.last_name) output "inserted"."account_id" AS "accountId",
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
   });
});

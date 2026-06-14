// noinspection SqlNoDataSourceInspection,SqlResolve
import { describe, expect, test } from "vitest";
import { Account } from "vexnor/testing";
import { sql } from "vexnor";
import { mssqlUpsert } from "#/crud/mssql-upsert.js";
import { defaultQueryOptions } from "#/default-query-options.js";

describe("mssqlUpsert()", () => {
   test("auto SET: generates col = src.col for all non-merge columns", () => {
      const query = mssqlUpsert(Account, { MERGE_ON: [Account.$accountId] });
      const { text, values } = query.source.getSql({
         params: { rows: [{ accountId: "id-1", email: "a@b.com", firstName: "John", lastName: "Doe" }] },
         options: defaultQueryOptions,
      });
      expect(text).toMatchInlineSnapshot(`
        "/* <query_0> */
        /* driver: transactsql */
        MERGE INTO
          "main"."account" using (
            VALUES
              /* <query_1> */ (@param_0, @param_1, @param_2, @param_3) /* </query_1> */
          ) AS src ("account_id", "email", "first_name", "last_name") ON (
            /* <query_2> */ "account"."account_id" = src.account_id /* </query_2> */
          )
        WHEN MATCHED THEN
        UPDATE SET
          /* <query_3> */ /* <query_4> */ /* <query_5> */ "email" = src.email /* </query_5> */,
          /* <query_6> */ "first_name" = src.first_name /* </query_6> */,
          /* <query_7> */ "last_name" = src.last_name /* </query_7> */ /* </query_4> */ /* </query_3> */
        WHEN NOT MATCHED THEN
        INSERT
          ("account_id", "email", "first_name", "last_name")
        VALUES
          (
            src.account_id,
            src.email,
            src.first_name,
            src.last_name
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

   test("custom SET: uses provided SET clause", () => {
      const query = mssqlUpsert(Account, {
         MERGE_ON: [Account.$accountId],
         SET: sql`${Account.$firstName} = src.first_name`,
      });
      const { text, values } = query.source.getSql({
         params: { rows: [{ accountId: "id-1", email: "a@b.com", firstName: "John", lastName: "Doe" }] },
         options: defaultQueryOptions,
      });
      expect(text).toMatchInlineSnapshot(`
        "/* <query_0> */
        /* driver: transactsql */
        MERGE INTO
          "main"."account" using (
            VALUES
              /* <query_1> */ (@param_0, @param_1, @param_2, @param_3) /* </query_1> */
          ) AS src ("account_id", "email", "first_name", "last_name") ON (
            /* <query_2> */ "account"."account_id" = src.account_id /* </query_2> */
          )
        WHEN MATCHED THEN
        UPDATE SET
          /* <query_3> */ /* <query_4> */ "first_name" = src.first_name /* </query_4> */ /* </query_3> */
        WHEN NOT MATCHED THEN
        INSERT
          ("account_id", "email", "first_name", "last_name")
        VALUES
          (
            src.account_id,
            src.email,
            src.first_name,
            src.last_name
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
      const query = mssqlUpsert(Account, { MERGE_ON: [Account.$accountId] });
      const { text, values } = query.source.getSql({
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
              /* <query_1> */ (@param_0, @param_1, @param_2, @param_3) /* </query_1> */,
              /* <query_2> */ (@param_4, @param_5, @param_6, @param_7) /* </query_2> */
          ) AS src ("account_id", "email", "first_name", "last_name") ON (
            /* <query_3> */ "account"."account_id" = src.account_id /* </query_3> */
          )
        WHEN MATCHED THEN
        UPDATE SET
          /* <query_4> */ /* <query_5> */ /* <query_6> */ "email" = src.email /* </query_6> */,
          /* <query_7> */ "first_name" = src.first_name /* </query_7> */,
          /* <query_8> */ "last_name" = src.last_name /* </query_8> */ /* </query_5> */ /* </query_4> */
        WHEN NOT MATCHED THEN
        INSERT
          ("account_id", "email", "first_name", "last_name")
        VALUES
          (
            src.account_id,
            src.email,
            src.first_name,
            src.last_name
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

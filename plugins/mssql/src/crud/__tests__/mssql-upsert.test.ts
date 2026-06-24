// noinspection SqlNoDataSourceInspection,SqlResolve
import { describe, expect, test } from "vitest";
import { Account } from "@vexnor/core/testing";
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

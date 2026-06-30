// noinspection SqlNoDataSourceInspection,SqlResolve
import { describe, expect, test } from "vitest";
import { Account } from "@vexnor/core/testing";
import { postgresUpsert } from "#src/crud/postgres-upsert.js";
import { defaultQueryOptions } from "#src/default-query-options.js";

describe("postgresUpsert()", () => {
   test("auto SET: generates col = EXCLUDED.col for all non-conflict columns", () => {
      const handler = postgresUpsert(Account, { CONFLICT_ON: [Account.$accountId] });
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
});

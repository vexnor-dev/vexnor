import { describe, expect, test } from "vitest";
import { Account } from "valnor/testing";
import { excluded, sql } from "valnor";
import { postgresUpsert } from "#/crud/postgres-upsert.js";
import { defaultQueryOptions } from "#/default-query-options.js";

describe("postgresUpsert()", () => {
   test("auto SET: generates col = EXCLUDED.col for all non-conflict columns", () => {
      const query = postgresUpsert(Account, { CONFLICT_ON: [Account.$accountId] });
      const { text, values } = query.getSql({
         params: { rows: [{ accountId: "id-1", email: "a@b.com", firstName: "John", lastName: "Doe" }] },
         options: defaultQueryOptions,
      });
      expect(text).toMatchInlineSnapshot(`
        "/* <query_0> */
        /* driver: postgres */
        INSERT INTO
          "main"."account" ("account_id", "email", "first_name", "last_name")
        VALUES
          /* <query_1> */
          ($1, $2, $3, $4) /* </query_1> */
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
      expect(values).toMatchInlineSnapshot(`
        [
          "id-1",
          "a@b.com",
          "John",
          "Doe",
        ]
      `);
   });

   test("custom SET: uses provided SET clause with excluded()", () => {
      const query = postgresUpsert(Account, {
         CONFLICT_ON: [Account.$accountId],
         SET: sql`${Account.$firstName} = ${excluded(Account).$firstName}`,
      });
      const { text, values } = query.getSql({
         params: { rows: [{ accountId: "id-1", email: "a@b.com", firstName: "John", lastName: "Doe" }] },
         options: defaultQueryOptions,
      });
      expect(text).toMatchInlineSnapshot(`
        "/* <query_0> */
        /* driver: postgres */
        INSERT INTO
          "main"."account" ("account_id", "email", "first_name", "last_name")
        VALUES
          /* <query_1> */
          ($1, $2, $3, $4) /* </query_1> */
        ON CONFLICT ("account_id") DO UPDATE
        SET
          /* <query_2> */ /* <query_3> */ "first_name" = EXCLUDED.first_name /* </query_3> */ /* </query_2> */
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

import { describe, expect, test } from "vitest";
import { Account } from "@test-models/vexnor_dev.schema.js";
import { sql } from "#/core/sql.js";
import { param } from "#/core/query/sql-param.js";
import { sqlDelete } from "#/core/crud/sql-delete.js";

describe("sqlTableDelete()", () => {
   test("should throw error without where or force", () => {
      expect(() =>
         sqlDelete(Account, {
            //@ts-expect-error build fails
            force: false,
         }),
      ).toThrow();
   });

   test("should generate delete query with where clause", () => {
      const query = sqlDelete(Account, {
         WHERE: sql`where ${Account.$accountId} = ${param<{ id: string }>("id")}`,
      });

      expect(query).toBeDefined();
      const { text } = query.getSql({ params: { id: "test-id" } });
      expect(text).toMatchInlineSnapshot(`
        "/* <query_0> */
        DELETE FROM "main"."account"
        /* <query_1> */
        WHERE
          /* <query_2> */
        WHERE
          "a_1"."account_id" = ? /* </query_2> */ /* </query_1> */ returning "account"."account_id" AS "accountId",
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

   test("should generate delete query with force flag", () => {
      const query = sqlDelete(Account, { force: true });

      expect(query).toBeDefined();
      const { text } = query.getSql({ options: { dialect: "sqlite" } });
      expect(text).toMatchInlineSnapshot(`
        "/* <query_0> */
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
});

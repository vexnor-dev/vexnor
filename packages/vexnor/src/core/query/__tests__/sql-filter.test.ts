import { describe, expect, test } from "vitest";
import { sql } from "#/core/sql.js";
import { filterBy, SqlFilterBy } from "#/core/query/sql-filter-by.js";
import { row } from "#/core/query/sql-select-row.js";
import { Account } from "@test-models/vexnor_dev.schema.js";
import { AccountStatusUdt } from "@test-models/vexnor_dev-enums.js";

describe("SqlFilter", () => {
   test("emits col = val pairs AND-separated for multiple keys", () => {
      const query = sql`
         SELECT ${row(Account.$$)}
         FROM ${Account}
         WHERE ${filterBy(Account)}
      `;

      const result = query.getSql({
         params: { filterBy: { email: "jane@example.com", status: AccountStatusUdt.CONFIRMED } },
      });

      expect(result.text).toMatchInlineSnapshot(`
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
        WHERE
          "a_1"."email" = ?
          AND "a_1"."status" = ?
          /* </query_0> */"
      `);
      expect(result.values).toMatchInlineSnapshot(`
        [
          "jane@example.com",
          "confirmed",
        ]
      `);
   });

   test("single key — no AND", () => {
      const query = sql`
         SELECT ${row(Account.$$)}
         FROM ${Account}
         WHERE ${filterBy(Account, "filterBy")}
      `;

      const result = query.getSql({
         params: { filterBy: { email: "jane@example.com" } },
      });

      expect(result.text).toMatchInlineSnapshot(`
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
        WHERE
          "a_1"."email" = ?
          /* </query_0> */"
      `);
      expect(result.values).toMatchInlineSnapshot(`
        [
          "jane@example.com",
        ]
      `);
   });

   test("skips undefined values", () => {
      const query = sql`
         SELECT ${row(Account.$$)}
         FROM ${Account}
         WHERE ${new SqlFilterBy(Account, { paramName: "filter" })}
      `;

      const result = query.getSql({
         params: { filter: { email: "jane@example.com", firstName: undefined, status: AccountStatusUdt.CREATED } },
      });

      expect(result.text).toMatchInlineSnapshot(`
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
        WHERE
          "a_1"."email" = ?
          AND "a_1"."status" = ?
          /* </query_0> */"
      `);
      expect(result.values).toMatchInlineSnapshot(`
        [
          "jane@example.com",
          "created",
        ]
      `);
   });

   test("handles null values (null is not undefined — it filters by IS NULL logic via placeholder)", () => {
      const query = sql`
         SELECT ${row(Account.$$)}
         FROM ${Account}
         WHERE ${new SqlFilterBy(Account, { paramName: "filter" })}
      `;

      const result = query.getSql({
         params: { filter: { email: "test@test.com", notes: null } },
      });

      expect(result.text).toMatchInlineSnapshot(`
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
        WHERE
          "a_1"."email" = ?
          AND "a_1"."notes" = ?
          /* </query_0> */"
      `);
      expect(result.values).toMatchInlineSnapshot(`
        [
          "test@test.com",
          null,
        ]
      `);
   });

   test("produces no output when all values are undefined", () => {
      const query = sql`
         SELECT ${row(Account.$$)}
         FROM ${Account}
         WHERE ${new SqlFilterBy(Account, { paramName: "filter" })}
      `;

      const result = query.getSql({
         params: { filter: { email: undefined, firstName: undefined } },
      });

      expect(result.text).toMatchInlineSnapshot(`
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
        WHERE
          /* </query_0> */"
      `);
      expect(result.values).toMatchInlineSnapshot(`[]`);
   });

   test("produces no output for empty object", () => {
      const query = sql`
         SELECT ${row(Account.$$)}
         FROM ${Account}
         WHERE ${new SqlFilterBy(Account, { paramName: "filter" })}
      `;

      const result = query.getSql({
         params: { filter: {} },
      });

      expect(result.text).toMatchInlineSnapshot(`
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
        WHERE
          /* </query_0> */"
      `);
      expect(result.values).toMatchInlineSnapshot(`[]`);
   });

   test("produces no output for null param", () => {
      const query = sql`
         SELECT ${row(Account.$$)}
         FROM ${Account}
         WHERE ${filterBy(Account, "filterBy")}
      `;

      const result = query.getSql({
         params: { filterBy: null },
      });

      expect(result.text).toMatchInlineSnapshot(`
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
        WHERE
          /* </query_0> */"
      `);
      expect(result.values).toMatchInlineSnapshot(`[]`);
   });

   test("throws on unknown column", () => {
      const query = sql`
         SELECT ${row(Account.$$)}
         FROM ${Account}
         WHERE ${new SqlFilterBy(Account, { paramName: "filter" })}
      `;

      expect(() =>
         query.getSql({
            // @ts-expect-error not a column
            params: { filter: { notAColumn: "value" } },
         }),
      ).toThrow("Column not found: notAColumn");
   });

   test("uses table alias in column references", () => {
      const query = sql`
         SELECT ${row(Account.$$)}
         FROM ${Account}
         WHERE ${filterBy(Account, "filterBy")}
      `;

      const result = query.getSql({
         params: { filterBy: { firstName: "Jane" } },
      });

      // Should include the table alias (a_1) in output
      expect(result.text).toMatchInlineSnapshot(`
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
        WHERE
          "a_1"."first_name" = ?
          /* </query_0> */"
      `);
      expect(result.values).toMatchInlineSnapshot(`
        [
          "Jane",
        ]
      `);
   });

   test("exposes .params property for query param collection", () => {
      const f = filterBy(Account, "filter");
      expect(f.params).toHaveProperty("filter");
   });
});

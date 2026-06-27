import { describe, expect, test } from "vitest";
import { sql } from "#src/core/sql.js";
import { filterBy, SqlFilterBy } from "#src/core/operators/sql-filter-by.js";
import { row } from "#src/core/query/sql-select-row.js";
import { Account, AccountStatusUdt } from "@test-models/vexnor_dev.schema.js";

function buildFilter(filterData?: Record<string, unknown> | Record<string, unknown>[] | null) {
   const query = sql`
      SELECT ${row(Account.$$)}
      FROM ${Account}
      WHERE ${new SqlFilterBy(Account, { paramName: "filter" })}
   `;

   return query.getSql({
      params: {
         filter: filterData ?? {}
      },
   });
}

describe("SqlFilter — extended operators", () => {
   describe("equality (bare value)", () => {
      test("string value", () => {
         const { text, values } = buildFilter({ email: "jane@example.com" });
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
           WHERE
             "a_1"."email" = ?
             /* </query_0> */"
         `);
         expect(values).toMatchInlineSnapshot(`
           [
             "jane@example.com",
           ]
         `);
      });

      test("null value", () => {
         const { text, values } = buildFilter({ notes: null });
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
           WHERE
             "a_1"."notes" = ?
             /* </query_0> */"
         `);
         expect(values).toMatchInlineSnapshot(`
           [
             null,
           ]
         `);
      });

      test("number value", () => {
         const { text, values } = buildFilter({ status: AccountStatusUdt.CONFIRMED });
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
           WHERE
             "a_1"."status" = ?
             /* </query_0> */"
         `);
         expect(values).toMatchInlineSnapshot(`
           [
             "confirmed",
           ]
         `);
      });
   });

   describe("equal operator (explicit)", () => {
      test("equal", () => {
         const { text, values } = buildFilter({ email: ["=", "test@test.com"] });
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
           WHERE
             "a_1"."email" = ?
             /* </query_0> */"
         `);
         expect(values).toMatchInlineSnapshot(`
           [
             "test@test.com",
           ]
         `);
      });
   });

   describe("not operator", () => {
      test("not", () => {
         const { text, values } = buildFilter({ status: ["not", "deleted"] });
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
           WHERE
             "a_1"."status" <> ?
             /* </query_0> */"
         `);
         expect(values).toMatchInlineSnapshot(`
           [
             "deleted",
           ]
         `);
      });
   });

   describe("greaterThan operator", () => {
      test("greaterThan", () => {
         const { text, values } = buildFilter({ createdAt: [">", "2024-01-01"] });
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
           WHERE
             "a_1"."created_at" > ?
             /* </query_0> */"
         `);
         expect(values).toMatchInlineSnapshot(`
           [
             "2024-01-01",
           ]
         `);
      });
   });

   describe("greaterOrEqual operator", () => {
      test("greaterOrEqual", () => {
         const { text, values } = buildFilter({ createdAt: [">=", "2024-01-01"] });
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
           WHERE
             "a_1"."created_at" >= ?
             /* </query_0> */"
         `);
         expect(values).toMatchInlineSnapshot(`
           [
             "2024-01-01",
           ]
         `);
      });
   });

   describe("lowerThan operator", () => {
      test("lowerThan", () => {
         const { text, values } = buildFilter({ createdAt: ["<", "2025-01-01"] });
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
           WHERE
             "a_1"."created_at" < ?
             /* </query_0> */"
         `);
         expect(values).toMatchInlineSnapshot(`
           [
             "2025-01-01",
           ]
         `);
      });
   });

   describe("lowerOrEqual operator", () => {
      test("lowerOrEqual", () => {
         const { text, values } = buildFilter({ createdAt: ["<=", "2025-12-31"] });
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
           WHERE
             "a_1"."created_at" <= ?
             /* </query_0> */"
         `);
         expect(values).toMatchInlineSnapshot(`
           [
             "2025-12-31",
           ]
         `);
      });
   });

   describe("between operator", () => {
      test("between two values", () => {
         const { text, values } = buildFilter({ createdAt: ["between", "2024-01-01", "2025-01-01"] });
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
           WHERE
             "a_1"."created_at" BETWEEN ? AND ?
             /* </query_0> */"
         `);
         expect(values).toMatchInlineSnapshot(`
           [
             "2024-01-01",
             "2025-01-01",
           ]
         `);
      });

      test("between with empty args emits is null", () => {
         const { text, values } = buildFilter({ createdAt: ["between"] });
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
           WHERE
             "a_1"."created_at" IS NULL
             /* </query_0> */"
         `);
         expect(values).toMatchInlineSnapshot(`[]`);
      });
   });

   describe("in operator", () => {
      test("in with values", () => {
         const { text, values } = buildFilter({ status: ["in", "active", "confirmed"] });
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
           WHERE
             "a_1"."status" IN (?, ?)
             /* </query_0> */"
         `);
         expect(values).toMatchInlineSnapshot(`
           [
             "active",
             "confirmed",
           ]
         `);
      });

      test("in with empty array emits is null", () => {
         const { text, values } = buildFilter({ status: ["in"] });
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
           WHERE
             "a_1"."status" IS NULL
             /* </query_0> */"
         `);
         expect(values).toMatchInlineSnapshot(`[]`);
      });
   });

   describe("notIn operator", () => {
      test("notIn with values", () => {
         const { text, values } = buildFilter({ status: ["notIn", "deleted", "banned"] });
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
           WHERE
             "a_1"."status" NOT IN (?, ?)
             /* </query_0> */"
         `);
         expect(values).toMatchInlineSnapshot(`
           [
             "deleted",
             "banned",
           ]
         `);
      });

      test("notIn with empty array emits is not null", () => {
         const { text, values } = buildFilter({ status: ["notIn"] });
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
           WHERE
             "a_1"."status" IS NOT NULL
             /* </query_0> */"
         `);
         expect(values).toMatchInlineSnapshot(`[]`);
      });
   });

   describe("like operator", () => {
      test("like", () => {
         const { text, values } = buildFilter({ email: ["like", "%@example.com"] });
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
           WHERE
             "a_1"."email" LIKE ?
             /* </query_0> */"
         `);
         expect(values).toMatchInlineSnapshot(`
           [
             "%@example.com",
           ]
         `);
      });
   });

   describe("notLike operator", () => {
      test("notLike", () => {
         const { text, values } = buildFilter({ email: ["notLike", "%@spam.com"] });
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
           WHERE
             "a_1"."email" NOT LIKE ?
             /* </query_0> */"
         `);
         expect(values).toMatchInlineSnapshot(`
           [
             "%@spam.com",
           ]
         `);
      });
   });

   describe("isNull operator", () => {
      test("isNull", () => {
         const { text, values } = buildFilter({ parentId: ["isNull"] });
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
           WHERE
             "a_1"."parent_id" IS NULL
             /* </query_0> */"
         `);
         expect(values).toMatchInlineSnapshot(`[]`);
      });
   });

   describe("isNotNull operator", () => {
      test("isNotNull", () => {
         const { text, values } = buildFilter({ parentId: ["isNotNull"] });
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
           WHERE
             "a_1"."parent_id" IS NOT NULL
             /* </query_0> */"
         `);
         expect(values).toMatchInlineSnapshot(`[]`);
      });
   });

   describe("AND composition (multiple conditions)", () => {
      test("two conditions on different columns", () => {
         const { text, values } = buildFilter({ status: "active", email: ["like", "%@example.com"] });
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
           WHERE
             "a_1"."status" = ?
             AND "a_1"."email" LIKE ?
             /* </query_0> */"
         `);
         expect(values).toMatchInlineSnapshot(`
           [
             "active",
             "%@example.com",
           ]
         `);
      });

      test("same column multiple times (range)", () => {
         const { text, values } = buildFilter([
            { createdAt: [">=", "2024-01-01"] },
            { createdAt: ["<", "2025-01-01"] },
         ]);
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
           WHERE
             "a_1"."created_at" >= ?
             AND "a_1"."created_at" < ?
             /* </query_0> */"
         `);
         expect(values).toMatchInlineSnapshot(`
           [
             "2024-01-01",
             "2025-01-01",
           ]
         `);
      });

      test("three conditions", () => {
         const { text, values } = buildFilter({
            status: "active",
            createdAt: [">=", "2024-01-01"],
            parentId: ["isNotNull"],
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
           WHERE
             "a_1"."status" = ?
             AND "a_1"."created_at" >= ?
             AND "a_1"."parent_id" IS NOT NULL
             /* </query_0> */"
         `);
         expect(values).toMatchInlineSnapshot(`
           [
             "active",
             "2024-01-01",
           ]
         `);
      });
   });

   describe("OR groups", () => {
      test("simple or", () => {
         const { text, values } = buildFilter({ or: [{ status: "active" }, { status: "confirmed" }] });
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
           WHERE
             (
               "a_1"."status" = ?
               OR "a_1"."status" = ?
             )
             /* </query_0> */"
         `);
         expect(values).toMatchInlineSnapshot(`
           [
             "active",
             "confirmed",
           ]
         `);
      });

      test("or with operators", () => {
         const { text, values } = buildFilter({
            or: [{ email: ["like", "%@vip.com"] }, { createdAt: [">", "2024-06-01"] }],
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
           WHERE
             (
               "a_1"."email" LIKE ?
               OR "a_1"."created_at" > ?
             )
             /* </query_0> */"
         `);
         expect(values).toMatchInlineSnapshot(`
           [
             "%@vip.com",
             "2024-06-01",
           ]
         `);
      });

      test("AND + OR combined", () => {
         const { text, values } = buildFilter({
            status: ["not", "deleted"],
            or: [{ email: ["like", "%@vip.com"] }, { parentId: ["isNotNull"] }],
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
           WHERE
             "a_1"."status" <> ?
             AND (
               "a_1"."email" LIKE ?
               OR "a_1"."parent_id" IS NOT NULL
             )
             /* </query_0> */"
         `);
         expect(values).toMatchInlineSnapshot(`
           [
             "deleted",
             "%@vip.com",
           ]
         `);
      });

      test("nested or inside or", () => {
         const { text, values } = buildFilter({
            or: [{ status: "active" }, { or: [{ email: ["like", "%@admin%"] }, { firstName: "Root" }] }],
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
           WHERE
             (
               "a_1"."status" = ?
               OR (
                 "a_1"."email" LIKE ?
                 OR "a_1"."first_name" = ?
               )
             )
             /* </query_0> */"
         `);
         expect(values).toMatchInlineSnapshot(`
           [
             "active",
             "%@admin%",
             "Root",
           ]
         `);
      });

      test("empty or array produces no output", () => {
         const { text, values } = buildFilter({ status: "active", or: [] });
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
           WHERE
             "a_1"."status" = ?
             /* </query_0> */"
         `);
         expect(values).toMatchInlineSnapshot(`
           [
             "active",
           ]
         `);
      });
   });

   describe("backwards compatibility — legacy object form", () => {
      test("plain object with multiple keys", () => {
         const { text, values } = buildFilter({ email: "jane@example.com", status: "active" });
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
           WHERE
             "a_1"."email" = ?
             AND "a_1"."status" = ?
             /* </query_0> */"
         `);
         expect(values).toMatchInlineSnapshot(`
           [
             "jane@example.com",
             "active",
           ]
         `);
      });

      test("plain object skips undefined", () => {
         const { text, values } = buildFilter({ email: "test@test.com", firstName: undefined });
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
           WHERE
             "a_1"."email" = ?
             /* </query_0> */"
         `);
         expect(values).toMatchInlineSnapshot(`
           [
             "test@test.com",
           ]
         `);
      });

      test("empty object produces no output", () => {
         const { text, values } = buildFilter({});
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
           WHERE
             /* </query_0> */"
         `);
         expect(values).toMatchInlineSnapshot(`[]`);
      });
   });

   describe("edge cases", () => {
      test("null filter produces no output", () => {
         const { text, values } = buildFilter(null);
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
           WHERE
             /* </query_0> */"
         `);
         expect(values).toMatchInlineSnapshot(`[]`);
      });

      test("undefined filter produces no output", () => {
         const { text, values } = buildFilter(undefined);
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
           WHERE
             /* </query_0> */"
         `);
         expect(values).toMatchInlineSnapshot(`[]`);
      });

      test("empty array produces no output", () => {
         const { text, values } = buildFilter([]);
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
           WHERE
             /* </query_0> */"
         `);
         expect(values).toMatchInlineSnapshot(`[]`);
      });

      test("condition with undefined value is skipped", () => {
         const { text, values } = buildFilter({ email: "test@test.com", firstName: undefined, status: "active" });
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
           WHERE
             "a_1"."email" = ?
             AND "a_1"."status" = ?
             /* </query_0> */"
         `);
         expect(values).toMatchInlineSnapshot(`
           [
             "test@test.com",
             "active",
           ]
         `);
      });
   });

   describe("error handling", () => {
      test("throws on unknown column", () => {
         expect(() => buildFilter({ notAColumn: "value" })).toThrow("Column not found: notAColumn");
      });

      test("throws on invalid operator", () => {
         expect(() => buildFilter({ email: ["invalidOp", "value"] })).toThrow("Invalid filter operator: invalidOp");
      });

      test("throws on non-primitive bare value", () => {
         expect(() => buildFilter({ email: { nested: "object" } })).toThrow("Filter value is not a primitive");
      });
   });
});

describe("SqlFilterBy — omit/include columns", () => {
   test("omit prevents filtering on specified columns", () => {
      const query = sql`
         SELECT ${row(Account.$$)}
         FROM ${Account}
         WHERE ${filterBy(Account, { paramName: "filterBy", omit: ["notes", "parentId"] })}
      `;
      expect(() =>
         query.getSql({ params: { filterBy: { notes: "test" } } }),
      ).toThrow("Column not found: notes");
   });

   test("omit allows filtering on non-omitted columns", () => {
      const query = sql`
         SELECT ${row(Account.$$)}
         FROM ${Account}
         WHERE ${filterBy(Account, { paramName: "filterBy", omit: ["notes", "parentId"] })}
      `;
      const { text, values } = query.getSql({ params: { filterBy: { email: "test@test.com" } } });
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
        WHERE
          "a_1"."email" = ?
          /* </query_0> */"
      `);
      expect(values).toMatchInlineSnapshot(`
        [
          "test@test.com",
        ]
      `);
   });

   test("include restricts filtering to only specified columns", () => {
      const query = sql`
         SELECT ${row(Account.$$)}
         FROM ${Account}
         WHERE ${filterBy(Account, { paramName: "filterBy", include: ["email", "status"] })}
      `;
      expect(() =>
         query.getSql({ params: { filterBy: { firstName: "Jane" } } }),
      ).toThrow("Column not found: firstName");
   });

   test("include allows filtering on included columns", () => {
      const query = sql`
         SELECT ${row(Account.$$)}
         FROM ${Account}
         WHERE ${filterBy(Account, { paramName: "filterBy", include: ["email", "status"] })}
      `;
      const { text, values } = query.getSql({ params: { filterBy: { email: "test@test.com", status: AccountStatusUdt.CREATED } } });
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
        WHERE
          "a_1"."email" = ?
          AND "a_1"."status" = ?
          /* </query_0> */"
      `);
      expect(values).toMatchInlineSnapshot(`
        [
          "test@test.com",
          "created",
        ]
      `);
   });

   test("omit takes precedence over include", () => {
      const query = sql`
         SELECT ${row(Account.$$)}
         FROM ${Account}
         WHERE ${filterBy(Account, { paramName: "filterBy", include: ["email", "status", "notes"], omit: ["notes"] })}
      `;
      expect(() =>
         query.getSql({ params: { filterBy: { notes: "test" } } }),
      ).toThrow("Column not found: notes");
   });
});

describe("SqlFilter — != operator", () => {
   test("!= emits col <> value", () => {
      const { text, values } = buildFilter([{ status: ["!=", "inactive"] }]);
      // This test exposes the bug: != has no case in writeOp, so it produces no output
      expect(text).toContain("<>");
      expect(values).toContain("inactive");
   });
});

describe("SqlFilterBy — serialize path (no params)", () => {
   test("serializes to filter operator node with columns", async () => {
      const { serializeQuery } = await import("#src/core/serialize/serialize-query.js");
      const query = sql`
         SELECT ${row(Account.$$)}
         FROM ${Account}
         WHERE ${filterBy(Account, { paramName: "filter", prefix: "AND ", suffix: " AND 1=1" })}
      `;
      const result = await serializeQuery(query, "filterSerialize", "postgresql");
      const filterNode = result.template.find((n: { type: string }) => n.type === "filter");
      expect(filterNode).toMatchInlineSnapshot(`
        {
          "columns": {
            "accountId": ""a_1"."account_id"",
            "createdAt": ""a_1"."created_at"",
            "email": ""a_1"."email"",
            "firstName": ""a_1"."first_name"",
            "lastName": ""a_1"."last_name"",
            "modifiedAt": ""a_1"."modified_at"",
            "notes": ""a_1"."notes"",
            "parentId": ""a_1"."parent_id"",
            "status": ""a_1"."status"",
          },
          "param": "filter",
          "prefix": "AND ",
          "suffix": " AND 1=1",
          "type": "filter",
        }
      `);
   });
});
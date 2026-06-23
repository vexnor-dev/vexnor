import { describe, expect, test } from "vitest";
import { sql } from "#/core/sql.js";
import { when, SqlWhen } from "#/core/query/sql-when.js";
import { param } from "#/core/query/sql-param.js";
import { row } from "#/core/query/sql-select-row.js";
import { raw } from "#/core/query/sql-raw.js";
import { Account } from "@test-models/vexnor_dev.schema.js";

type FilterParams = { status: string; hasEmail: boolean; email: string };

describe("SqlWhen", () => {
   describe("single branch (include or omit)", () => {
      test("includes fragment when flag is true", () => {
         const query = sql`
            SELECT ${row(Account.$$)}
            FROM ${Account}
            WHERE ${Account.$status} = ${param<FilterParams>("status")}
            ${when("hasEmail", sql`AND ${Account.$email} = ${param<FilterParams>("email")}`)}
         `;

         const result = query.getSql({ params: { status: "active", hasEmail: true, email: "test@example.com" } });

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
             "a_1"."status" = ?
             /* <query_1> */
             AND "a_1"."email" = ? /* </query_1> */
             /* </query_0> */"
         `);
         expect(result.values).toMatchInlineSnapshot(`
           [
             "active",
             "test@example.com",
           ]
         `);
      });

      test("omits fragment when flag is false", () => {
         const query = sql`
            SELECT ${row(Account.$$)}
            FROM ${Account}
            WHERE ${Account.$status} = ${param<FilterParams>("status")}
            ${when("hasEmail", sql`AND ${Account.$email} = ${param<FilterParams>("email")}`)}
         `;

         const result = query.getSql({ params: { status: "active", hasEmail: false, email: "" } });

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
             "a_1"."status" = ?
             /* </query_0> */"
         `);
         expect(result.values).toMatchInlineSnapshot(`
           [
             "active",
           ]
         `);
      });

      test("omits fragment when flag is undefined (falsy)", () => {
         const query = sql`
            SELECT ${row(Account.$$)}
            FROM ${Account}
            WHERE ${Account.$status} = ${param<FilterParams>("status")}
            ${when("hasEmail", sql`AND ${Account.$email} = ${param<FilterParams>("email")}`)}
         `;

         const result = query.getSql({
            params: { status: "active", hasEmail: undefined as unknown as boolean, email: "" },
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
             "a_1"."status" = ?
             /* </query_0> */"
         `);
         expect(result.values).toMatchInlineSnapshot(`
           [
             "active",
           ]
         `);
      });
   });

   describe("binary branch (onTrue / onFalse)", () => {
      test("uses onTrue when flag is true", () => {
         const query = sql`
            SELECT ${row(Account.$$)}
            FROM ${Account}
            ORDER BY ${Account.$createdAt} ${when("sortAsc", sql`ASC`, sql`DESC`)}
         `;

         const result = query.getSql({ params: { sortAsc: true } });

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
           ORDER BY
             "a_1"."created_at" /* <query_1> */ ASC /* </query_1> */
             /* </query_0> */"
         `);
         expect(result.values).toMatchInlineSnapshot(`[]`);
      });

      test("uses onFalse when flag is false", () => {
         const query = sql`
            SELECT ${row(Account.$$)}
            FROM ${Account}
            ORDER BY ${Account.$createdAt} ${when("sortAsc", sql`ASC`, sql`DESC`)}
         `;

         const result = query.getSql({ params: { sortAsc: false } });

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
           ORDER BY
             "a_1"."created_at" /* <query_1> */ DESC /* </query_1> */
             /* </query_0> */"
         `);
         expect(result.values).toMatchInlineSnapshot(`[]`);
      });
   });

   describe("composition", () => {
      test("multiple when() clauses compose independently", () => {
         const query = sql`
            SELECT ${row(Account.$$)}
            FROM ${Account}
            WHERE 1 = 1
            ${when("hasEmail", sql`AND ${Account.$email} = ${param("email")}`)}
            ${when("hasStatus", sql`AND ${Account.$status} = ${param("status")}`)}
         `;

         const result = query.getSql({
            params: { hasEmail: true, email: "test@example.com", hasStatus: false, status: "" },
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
             1 = 1
             /* <query_1> */
             AND "a_1"."email" = ? /* </query_1> */
             /* </query_0> */"
         `);
         expect(result.values).toMatchInlineSnapshot(`
           [
             "test@example.com",
           ]
         `);
      });

      test("both when() active", () => {
         const query = sql`
            SELECT ${row(Account.$$)}
            FROM ${Account}
            WHERE 1=1
            ${when("hasEmail", sql`AND ${Account.$email} = ${param("email")}`)}
            ${when("hasStatus", sql`AND ${Account.$status} = ${param("status")}`)}
         `;

         const result = query.getSql({
            params: { hasEmail: true, email: "test@example.com", hasStatus: true, status: "active" },
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
             1 = 1
             /* <query_1> */
             AND "a_1"."email" = ? /* </query_1> */
             /* <query_2> */
             AND "a_1"."status" = ? /* </query_2> */
             /* </query_0> */"
         `);
         expect(result.values).toMatchInlineSnapshot(`
           [
             "test@example.com",
             "active",
           ]
         `);
      });
   });
});

   describe("coverage — plain Sql branches (non-SqlQuery)", () => {
      test("when with raw() as onTrue branch", () => {
         const query = sql`
            SELECT ${row(Account.$$)}
            FROM ${Account}
            ORDER BY ${Account.$createdAt} ${when("sortAsc", raw("ASC"), raw("DESC"))}
         `;

         const result = query.getSql({ params: { sortAsc: true } });

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
           ORDER BY
             "a_1"."created_at" ASC
             /* </query_0> */"
         `);
         expect(result.values).toMatchInlineSnapshot(`[]`);
      });

      test("when with raw() as onFalse branch", () => {
         const query = sql`
            SELECT ${row(Account.$$)}
            FROM ${Account}
            ORDER BY ${Account.$createdAt} ${when("sortAsc", raw("ASC"), raw("DESC"))}
         `;

         const result = query.getSql({ params: { sortAsc: false } });

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
           ORDER BY
             "a_1"."created_at" DESC
             /* </query_0> */"
         `);
         expect(result.values).toMatchInlineSnapshot(`[]`);
      });
   });

   test("builds with raw Sql node (non-SqlQuery) in branch", () => {
      const query = sql`
         SELECT 1
         ${when("hasLimit", raw("LIMIT 10"))}
      `;

      const result = query.getSql({
         params: { hasLimit: true },
         options: { dialect: "sql", format: false },
      });
      expect(result.text).toContain("LIMIT 10");
   });

   test("builds with raw Sql node in false branch", () => {
      const query = sql`
         SELECT 1
         ${when("sortAsc", raw("ASC"), raw("DESC"))}
      `;

      const result = query.getSql({
         params: { sortAsc: false },
         options: { dialect: "sql", format: false },
      });
      expect(result.text).toContain("DESC");
   });

describe("SqlWhen — negation", () => {
   test("negated when — includes onTrue when param is falsy", () => {
      const query = sql`
         SELECT ${row(Account.$$)}
         FROM ${Account}
         ${when("!hasEmail", sql`WHERE ${Account.$email} IS NULL`)}
      `;
      const result = query.getSql({ params: { "!hasEmail": false }, options: { dialect: "sqlite" } });
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
          /* <query_1> */
        WHERE
          "a_1"."email" IS NULL /* </query_1> */
          /* </query_0> */"
      `);
      expect(result.values).toMatchInlineSnapshot(`[]`);
   });

   test("negated when — excludes onTrue when param is truthy", () => {
      const query = sql`
         SELECT ${row(Account.$$)}
         FROM ${Account}
         ${when("!hasEmail", sql`WHERE ${Account.$email} IS NULL`)}
      `;
      const result = query.getSql({ params: { "!hasEmail": true }, options: { dialect: "sqlite" } });
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
          /* <query_1> */
        WHERE
          "a_1"."email" IS NULL /* </query_1> */
          /* </query_0> */"
      `);
      expect(result.values).toMatchInlineSnapshot(`[]`);
   });

   test("negated when — with onFalse branch", () => {
      const query = sql`
         SELECT 1
         ${when("!isAdmin", raw("/* not admin */"), raw("/* is admin */"))}
      `;
      const trueResult = query.getSql({ params: { "!isAdmin": true }, options: { dialect: "sql", format: false } });
      expect(trueResult.text).toMatchInlineSnapshot(`
        " /* <query_0> */ 
                 SELECT 1
                 /* not admin */
              /* </query_0> */"
      `);

      const falseResult = query.getSql({ params: { "!isAdmin": false }, options: { dialect: "sql", format: false } });
      expect(falseResult.text).toMatchInlineSnapshot(`
        " /* <query_0> */ 
                 SELECT 1
                 /* not admin */
              /* </query_0> */"
      `);
   });

   test("negated when — serialization includes negate field", () => {
      const query = sql`
         SELECT 1
         ${when("!flag", raw("LIMIT 10"))}
      `;
      const result = query.getSql({ params: { "!flag": false }, options: { dialect: "sqlite" } });
      expect(result.text).toMatchInlineSnapshot(`
        "/* <query_0> */
        SELECT
          1
        LIMIT
          10
          /* </query_0> */"
      `);
   });

   test("non-negated when does not set negate", () => {
      const node = new SqlWhen({ paramName: "flag", onTrue: raw("X") });
      expect(node.negate).toBe(false);
      expect(node.paramName).toBe("flag");
   });

   test("negated when sets negate and strips prefix", () => {
      const node = new SqlWhen({ paramName: "flag", negate: true, onTrue: raw("X") });
      expect(node.negate).toBe(true);
      expect(node.paramName).toBe("flag");
   });
});

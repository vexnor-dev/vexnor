import { describe, expect, test } from "vitest";
import { sql } from "#src/core/sql.js";
import { row } from "#src/core/query/sql-select-row.js";
import { Account } from "@test-models/vexnor_dev.account-table.js";
import { SqlBuildContext } from "#src/core/builder/sql-build-context.js";

describe("SqlBuildOptions — boundaryComments", () => {
   test("boundaryComments: false suppresses open/close comment tags", () => {
      const q = sql`SELECT ${row(Account.$email)} FROM ${Account}`;
      const ctx = new SqlBuildContext({ dialect: "sql" });
      q.write(ctx, { boundaryComments: false });
      expect(ctx.text).toMatchInlineSnapshot(`
        "SELECT
          "a_1"."email"
        FROM
          "main"."account" AS "a_1""
      `);
   });

   test("boundaryComments: true (default) emits comment tags", () => {
      const q = sql`SELECT ${row(Account.$email)} FROM ${Account}`;
      const ctx = new SqlBuildContext({ dialect: "sql" });
      q.write(ctx, { boundaryComments: true });
      expect(ctx.text).toMatchInlineSnapshot(`
        "/* <query_0> */
        SELECT
          "a_1"."email"
        FROM
          "main"."account" AS "a_1" /* </query_0> */"
      `);
   });

   test("boundaryComments: false suppresses nested subquery tags", () => {
      const inner = sql`SELECT ${row(Account.$email)} FROM ${Account}`;
      const q = sql`SELECT * FROM (${inner})`;
      const ctx = new SqlBuildContext({ dialect: "sql" });
      q.write(ctx, { boundaryComments: false });
      expect(ctx.text).toMatchInlineSnapshot(`
        "SELECT
          *
        FROM
          (
            (
              SELECT
                "a_1"."email"
              FROM
                "main"."account" AS "a_1"
            ) AS "query_1"
          )"
      `);
   });
});

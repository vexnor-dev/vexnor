import { describe, expect, test } from "vitest";
import { sql } from "#/core/sql.js";
import { SqlBuildContext } from "#/core/builder/sql-build-context.js";
import { SqlBuildError } from "#/core/sql-build-error.js";
import { info } from "#/core/charms/sql-query-info.js";
import { SqlQuery, SqlQueryFormatByKeyword } from "#/core/query/sql-query.js";

describe("SqlQuery.buildInternalQuery()", () => {
   test("'with' case (happy path): emits `\"name\" as (` ... `)` around the token", () => {
      const token = sql`SELECT 1`;
      const context = new SqlBuildContext();
      context.next("with ");

      SqlQuery.buildInnerQueryRef(token, context);

      expect(context.text).toMatchInlineSnapshot(`
        ""query_0" AS (
          /* <query_0> */
          SELECT
            1 /* </query_0> */
        )"
      `);
   });

   test("'select' case (happy path): wraps token in `(` ... `) as \"name\"`", () => {
      const token = sql`SELECT 1`;
      const context = new SqlBuildContext();
      context.next("select ");

      SqlQuery.buildInnerQueryRef(token, context);

      expect(context.text).toMatchInlineSnapshot(`
        "(
          /* <query_0> */
          SELECT
            1 /* </query_0> */
        ) AS "query_0""
      `);
   });

   test("'from' case (happy path, non-CTE): wraps token in `(` ... `) as \"name\"`", () => {
      const token = sql`SELECT 1`;
      const context = new SqlBuildContext();
      context.next("select * from ");

      SqlQuery.buildInnerQueryRef(token, context);

      expect(context.text).toMatchInlineSnapshot(`
        "(
          /* <query_0> */
          SELECT
            1 /* </query_0> */
        ) AS "query_0""
      `);
   });

   // BUG: getQueryName() calls addQuery() internally with cte=false, overwriting the pre-registered cte=true,
   // so isCTE() always returns false and the token is never treated as a CTE reference.
   test(`"'from' case (edge case, CTE token): emits only "name" without wrapping"`, () => {
      const token = sql`SELECT 1`;
      const context = new SqlBuildContext();
      context.addQuery(token, { cte: true });
      context.next("select * from ");

      SqlQuery.buildInnerQueryRef(token, context);

      expect(context.text).toMatchInlineSnapshot(`""query_0""`);
   });

   test("'join' case (happy path, non-CTE): wraps token in `(` ... `) as \"name\"`", () => {
      const token = sql`SELECT 1`;
      const context = new SqlBuildContext();
      context.next("select * from t join ");

      SqlQuery.buildInnerQueryRef(token, context);

      expect(context.text).toMatchInlineSnapshot(`
        "(
          /* <query_0> */
          SELECT
            1 /* </query_0> */
        ) AS "query_0""
      `);
   });

   // BUG: same as 'from' CTE case - getQueryName() resets cte=false before isCTE() is checked.
   test("'join' case (edge case, CTE token): emits only `\"name\"` without wrapping", () => {
      const token = sql`SELECT 1`;
      const context = new SqlBuildContext();
      context.addQuery(token, { cte: true });
      context.next("select * from t join ");

      SqlQuery.buildInnerQueryRef(token, context);

      expect(context.text).toMatchInlineSnapshot(`"\"query_0\""`);
   });

   test("'fn' case (happy path): emits only `\"name\"`", () => {
      const token = sql`${info({ label: "MyFn" })} SELECT 1`;
      const context = new SqlBuildContext();
      context.next("select max(");

      SqlQuery.buildInnerQueryRef(token, context);

      expect(context.text).toMatchInlineSnapshot(`"\"MyFn\""`);
   });

   test("'sql' case (happy path, keyword=undefined): inlines the token without any wrapping", () => {
      const token = sql`SELECT 1`;
      const context = new SqlBuildContext();
      // no context.next() -> keyword is undefined -> resolves to 'sql'

      SqlQuery.buildInnerQueryRef(token, context);

      expect(context.text).toMatchInlineSnapshot(`
        "/* <query_0> */
        SELECT
          1 /* </query_0> */"
      `);
   });

   test("'null' case (edge case, token.queryType=null): falls through to context.keyword", () => {
      const token = sql`SELECT 1`;
      (token as unknown as { queryType: null }).queryType = null;
      const context = new SqlBuildContext();
      context.next("select * from ");
      // null ?? context.keyword -> 'from' -> wraps as subquery

      SqlQuery.buildInnerQueryRef(token, context);

      expect(context.text).toMatchInlineSnapshot(`
        "(
          /* <query_0> */
          SELECT
            1 /* </query_0> */
        ) AS "query_0""
      `);
   });

   test(`query.queryFormat (edge case, overrides context.keyword): uses query.queryFormat=from over context.keyword=${SqlQueryFormatByKeyword["select"]}`, () => {
      const token = sql`${info({ label: "TypeOverride" })} SELECT 1`.render("fn");
      // force 'fn' queryType: only emits the name, no token.build() call, cleanly proves the override
      const context = new SqlBuildContext();
      context.next("select"); // keyword='select', but token.queryType='fn' wins -> emits only name

      SqlQuery.buildInnerQueryRef(token, context);

      expect(context.text).toMatchInlineSnapshot(`"\"TypeOverride\""`);
   });

   test("default case: throws SqlBuildError for unknown queryType", () => {
      //@ts-expect-error testing errors
      const token = sql`SELECT 1`.render("unsupported");

      expect(() => SqlQuery.buildInnerQueryRef(token, new SqlBuildContext())).toThrow(SqlBuildError);
   });
});

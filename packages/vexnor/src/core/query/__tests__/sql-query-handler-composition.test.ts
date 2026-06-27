import { describe, expect, test } from "vitest";
import { sql } from "#src/core/sql.js";
import { row } from "#src/core/query/sql-select-row.js";
import { newSqlQueryHandler } from "#src/core/query/sql-query-handler.js";
import { MockQueryHandler } from "#src/test/mock-query-handler.js";
import { Account } from "@test-models/vexnor_dev.account-table.js";
import { SqlQuery } from "#src/core/query/sql-query.js";

function handlerSql<T extends { Row?: unknown; Params?: unknown }>(query: SqlQuery<T>) {
   return newSqlQueryHandler<T, MockQueryHandler<T>>(new MockQueryHandler(query));
}

describe("IQuery composition — handler embedded in sql template", () => {
   test("handler in WITH clause produces CTE wrapping", () => {
      const inner = handlerSql(sql`select ${row(Account.$accountId, Account.$email)} from ${Account}`);
      const query = sql`with ${inner} select ${row(inner.$accountId)} from ${inner}`;
      const { text } = query.getSql({});
      expect(text).toMatchInlineSnapshot(`
        "/* <query_0> */
        WITH
          "query_1" AS (
            /* <query_1> */
            SELECT
              "a_1"."account_id" AS "accountId",
              "a_1"."email"
            FROM
              "main"."account" AS "a_1" /* </query_1> */
          )
        SELECT
          "query_1"."accountId"
        FROM
          "query_1" /* </query_0> */"
      `);
   });

   test("handler in FROM clause produces subquery alias", () => {
      const inner = handlerSql(sql`select ${row(Account.$accountId, Account.$email)} from ${Account}`);
      const query = sql`select ${row(inner.$accountId)} from ${inner}`;
      const { text } = query.getSql({});
      expect(text).toMatchInlineSnapshot(`
        "/* <query_0> */
        SELECT
          "query_1"."accountId"
        FROM
          (
            /* <query_1> */
            SELECT
              "a_1"."account_id" AS "accountId",
              "a_1"."email"
            FROM
              "main"."account" AS "a_1" /* </query_1> */
          ) AS "query_1" /* </query_0> */"
      `);
   });

   test("column accessors are accessible on handler proxy", () => {
      const inner = handlerSql(sql`select ${row(Account.$accountId, Account.$email)} from ${Account}`);
      expect(inner.$accountId).toBeDefined();
      expect(inner.$email).toBeDefined();
      // @ts-expect-error — $lastName was not selected
      expect(inner.$lastName).toBeUndefined();
   });

   test("innerQueries includes handler's source when embedded in parent", () => {
      const inner = handlerSql(sql`select ${row(Account.$accountId)} from ${Account}`);
      const parent = sql`select ${row(inner.$accountId)} from ${inner}`;
      expect(parent.innerQueries.some((q) => q === inner.source)).toBe(true);
   });

   test("dialects propagated from handler source", () => {
      const inner = handlerSql(sql`select ${row(Account.$accountId)} from ${Account}`);
      const parent = sql`select ${row(inner.$accountId)} from ${inner}`;
      expect([...parent.dialects]).toMatchInlineSnapshot(`
        [
          "sql",
        ]
      `);
   });
});

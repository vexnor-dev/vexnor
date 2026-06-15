import { describe, expect, test } from "vitest";
import { row, sql, SqlBuildContext } from "@vexnor/core";
import { JsonAggregationSqlite3, jsonMany, jsonOne } from "#/charms/json-aggregation-sqlite3.js";
import { Account } from "@vexnor/core/testing";

describe("json-aggregation-sqlite3 error branches", () => {
   test("jsonMany throws on unsupported keyword (from)", () => {
      const context = new SqlBuildContext();
      context.next("from");
      const target = jsonMany(
         sql`select ${row(Account.$$)} from ${Account}`,
      );
      expect(() => target.build(context, {})).toThrow("Cannot use json aggregation with SQL keyword");
   });

   test("jsonOne throws on unsupported keyword (from)", () => {
      const context = new SqlBuildContext();
      context.next("from");
      const AccountParent = sql`select ${row(Account.$$)} from ${Account.as("parent")} where ${Account.as("parent").$accountId} = ${Account.$parentId}`;
      const target = jsonOne(AccountParent);
      expect(() => target.build(context, {})).toThrow("Cannot use json aggregation with SQL keyword");
   });

   test("jsonOne throws when query has no $$", () => {
      const queryNoRow = sql`SELECT 1`;
      expect(() => jsonOne(queryNoRow as never)).toThrow("query.$$");
   });

   test("jsonMany throws when query row is missing at build time", () => {
      const context = new SqlBuildContext();
      context.next("select");
      const queryNoRow = sql`SELECT 1`;
      const target = new JsonAggregationSqlite3(queryNoRow, { type: "many" });
      expect(() => target.build(context, {})).toThrow("is required for json aggregation");
   });

   test("jsonMany renders select with correct SQL", () => {
      const context = new SqlBuildContext();
      context.next("select");
      const target = jsonMany(
         sql`select ${row(Account.$$)} from ${Account}`,
      );
      target.build(context, {});
      expect(context.text).toMatchInlineSnapshot(`
        "(
          /* <query_0> */
          SELECT
            coalesce(
              json_group_array (json_object ("query_1".*)),
              '[]'
            )
          FROM
            (
              /* <query_1> */
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
                "main"."account" AS "a_1" /* </query_1> */
            ) AS "query_1" /* </query_0> */
        )"
      `);
   });

   test("jsonOne renders select with correct SQL", () => {
      const context = new SqlBuildContext();
      context.next("select");
      const AccountParent = sql`select ${row(Account.$$)} from ${Account.as("parent")} where ${Account.as("parent").$accountId} = ${Account.$parentId}`;
      const target = jsonOne(AccountParent);
      target.build(context, {});
      expect(context.text).toMatchInlineSnapshot(`
        "(
          /* <query_0> */
          SELECT
            json_object ("query_1".*)
          FROM
            (
              /* <query_1> */
              SELECT
                "query_2".*
              FROM
                (
                  /* <query_2> */
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
                    "main"."account" AS "parent"
                  WHERE
                    "parent"."account_id" = "a_1"."parent_id" /* </query_2> */
                ) AS "query_2"
              LIMIT
                1 /* </query_1> */
            ) AS "query_1"
          LIMIT
            1 /* </query_0> */
        )"
      `);
   });
});

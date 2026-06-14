import { describe, expect, test } from "vitest";
import { row, sql, SqlBuildContext } from "vexnor";
import { JsonAggregationPostgres, jsonMany, jsonOne } from "#/charms/json-aggregation-postgres.js";
import { Account } from "vexnor/testing";

describe("json-aggregation-postgres error branches", () => {
   test("jsonMany throws on unsupported keyword (where)", () => {
      const context = new SqlBuildContext();
      context.next("where");
      const target = jsonMany(
         sql`select ${row(Account.$$)} from ${Account}`,
      );
      expect(() => target.build(context, {})).toThrow("Cannot use");
   });

   test("jsonOne throws on unsupported keyword (where)", () => {
      const context = new SqlBuildContext();
      context.next("where");
      const AccountParent = sql`select ${row(Account.$$)} from ${Account.as("parent")} where ${Account.as("parent").$accountId} = ${Account.$parentId}`;
      const target = jsonOne(AccountParent);
      expect(() => target.build(context, {})).toThrow("Cannot use");
   });

   test("jsonOne throws when query has no $$", () => {
      const queryNoRow = sql`SELECT 1`;
      expect(() => jsonOne(queryNoRow as never)).toThrow("query.$$");
   });

   test("jsonMany throws when query row is missing at build time", () => {
      const context = new SqlBuildContext();
      context.next("select");
      const queryNoRow = sql`SELECT 1`;
      const target = new JsonAggregationPostgres(queryNoRow, { type: "many" });
      expect(() => target.build(context, {})).toThrow("query row is required");
   });

   test("jsonMany on 'on true' keyword renders lateral join", () => {
      const context = new SqlBuildContext();
      context.next("on true");
      const target = jsonMany(
         sql`select ${row(Account.$$)} from ${Account}`,
      );
      target.build(context, {});
      expect(context.text).toMatchInlineSnapshot(`
        "/* <query_1> */
        /* inline: true */
        LEFT JOIN LATERAL (
          SELECT
            coalesce(jsonb_agg ("query_0".*), '[]') AS "query_0_result"
          FROM
            (
              /* <query_0> */
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
                "main"."account" AS "a_1" /* </query_0> */
            ) AS "query_0"
        ) AS "query_0" ON TRUE
        /* </query_1> */"
      `);
   });
});

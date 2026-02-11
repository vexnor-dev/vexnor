import { assertType, describe, expect, test } from "vitest";
import { ExtractCharmParams, SqlCharm, SqlSelectCharm } from "../sql-charm.js";
import { param, SqlParam } from "../sql-param.js";
import { sql } from "../../sql.js";
import { row } from "../sql-select-row.js";
import { Account } from "@test-models/valnor_test.account-table.js";
import { SqlBuildContext } from "../sql-build-context.js";
import { SqlBuildOptions } from "../sql-query-types.js";
import { SqlQuery } from "../sql-query.js";
import { TYPES } from "../sql-models.js";

describe("SqlCharm tests", () => {
   test("charm should infer Params from inner query", () => {
      const query = sql`
         select ${row(Account.$$)}
         from ${Account}
         where ${Account.$status} = ${param("status").is<string>()}
         limit ${param("limit").is<number>()}
      `;

      const charm = testCharm(query);
      assertType<{
         limit: SqlParam<{ Name: "limit"; Type: number }>;
         status: SqlParam<{ Name: "status"; Type: string }>;
      }>(charm.params);
      expect(charm.params).toMatchObject({
         status: { name: "status" },
         limit: { name: "limit" },
      });
      type Params = ExtractCharmParams<typeof charm>;
      assertType<Params>({ limit: 1, test: "x" });
   });

   test("query should infer Params from inner charm", () => {
      const query = sql`
         select ${row(Account.$$)}
         from ${Account}
         where ${Account.$status} = ${param("status").is<string>()}
         limit ${param({ limit: TYPES.Number })}
      `;
      const charm = testCharm(query);

      assertType<{
         limit: SqlParam<{ Name: "limit"; Type: number }>;
         status: SqlParam<{ Name: "status"; Type: string }>;
      }>(charm.params);
      expect(charm.params).toMatchObject({
         status: { name: "status" },
         limit: { name: "limit" },
      });
   });

   test("subquery to self table", () => {
      const accountChildren = sql`
         select ${row(Account.as`children`.$$)}
         from ${Account.as`children`}
         where ${Account.as`children`.$parentId} = ${Account.$accountId}
         order by ${Account.as`children`.$email}
      `;

      const accountIds: string[] = ["aa", "bb"];
      const query = sql`
         select ${row(Account.$$)}, ${testCharm(accountChildren).as("children")}
         from ${Account}
         where ${Account.$accountId} in (${accountIds})
         order by ${Account.$email}
      `;

      const { text, values } = query.getSql({});
      expect(values).toEqual(["aa", "bb"]);
      expect(text).toMatchInlineSnapshot(`
        "SELECT
          "a_1"."account_id" AS "accountId",
          "a_1"."status",
          "a_1"."email",
          "a_1"."first_name" AS "firstName",
          "a_1"."last_name" AS "lastName",
          "a_1"."notes",
          "a_1"."created_at" AS "createdAt",
          "a_1"."modified_at" AS "modifiedAt",
          "a_1"."parent_id" AS "parentId",
          (
            SELECT
              "children"."account_id" AS "accountId",
              "children"."status",
              "children"."email",
              "children"."first_name" AS "firstName",
              "children"."last_name" AS "lastName",
              "children"."notes",
              "children"."created_at" AS "createdAt",
              "children"."modified_at" AS "modifiedAt",
              "children"."parent_id" AS "parentId"
            FROM
              "valnor_test"."account" AS "children"
            WHERE
              "children"."parent_id" = "a_1"."account_id"
            ORDER BY
              "children"."email" FOR JSON AUTO
          ) AS "children"
        FROM
          "valnor_test"."account" AS "a_1"
        WHERE
          "a_1"."account_id" IN (?, ?)
        ORDER BY
          "a_1"."email""
      `);
   });
});

class TestCharm<T extends { Params?: unknown; Row?: unknown }> extends SqlCharm<{
   Params: T["Params"];
}> {
   constructor(public readonly query: SqlQuery<{ Params: T["Params"]; Row?: T["Row"] }>) {
      super({
         ID: "test",
         params: query.params,
      });
   }

   build(_context: SqlBuildContext, _options: SqlBuildOptions | undefined): void {
      throw new Error("Method not implemented.");
   }

   as<Key extends string>(key: Key) {
      const query = this.query;
      return new SqlSelectCharm({
         key,
         build(context, options) {
            context.addStrings(`(`);
            query.build(context, options);
            context.addStrings(` FOR JSON AUTO `, `)`);

            context.addStrings(`as "${key}"`);
         },
      });
   }
}

function testCharm<Params, Row>(
   query: SqlQuery<{ Params: Params; Row: Row }>,
): TestCharm<{ Params: Params; Row: Row }> {
   return new TestCharm<{ Params: Params; Row: Row }>(query);
}

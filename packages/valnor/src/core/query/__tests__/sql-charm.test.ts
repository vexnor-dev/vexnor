import { assertType, describe, expect, test } from "vitest";
import { ExtractCharmParams, SqlCharm, SqlSelectCharm } from "../sql-charm.js";
import { BuildSqlParams, param, SqlParam } from "../sql-param.js";
import { sql } from "../../sql.js";
import { row } from "../sql-select-row.js";
import { Account } from "@test-models/valnor_test.account-table.js";
import { SqlBuildContext } from "../sql-build-context.js";
import { SqlBuildOptions } from "../sql-query-types.js";
import { SqlQuery } from "../sql-query.js";
import { AccountStatusUdt } from "@test-models/valnor_test-enums.js";

describe("SqlCharm tests", () => {
   test("charm should infer Params from inner query", () => {
      const query = sql`
         select ${row(Account.$$)}
         from ${Account}
         where ${Account.$status} = ${param<{ status: AccountStatusUdt }>("status")}
         limit ${param<{ limit: number }>("limit")}
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
         where ${Account.$status} = ${param<{ status: string }>("status")}
         limit ${param<{ limit: number }>("limit")}
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
         where ${Account.as`children`.$parentId} = ${Account.out.$accountId}
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
          "a_1"."parent_id" AS "parentId",
          (
            /* <query_1> */
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
              "main"."account" AS "children"
            WHERE
              "children"."parent_id" = "a_1"."account_id"
            ORDER BY
              "children"."email"
              /* </query_1> */
              FOR JSON AUTO
          ) AS "children"
        FROM
          "main"."account" AS "a_1"
        WHERE
          "a_1"."account_id" IN (?, ?)
        ORDER BY
          "a_1"."email"
          /* </query_0> */"
      `);
      expect(values).toEqual(["aa", "bb"]);
   });
});

class TestCharm<T extends { Params?: unknown; Row?: unknown }> extends SqlCharm<Pick<T, "Params">> {
   constructor(public readonly query: SqlQuery<T>) {
      super({
         id: "test",
         params: query.params,
      });
   }

   // eslint-disable-next-line unused-imports/no-unused-vars
   build(_context: SqlBuildContext, _options: SqlBuildOptions | undefined): void {
      throw new Error("Method not implemented.");
   }

   as<Key extends string>(key: Key): SqlSelectCharm<{ Key: Key; Type: string; Params: T["Params"] }> {
      return new SqlSelectCharm<{ Key: Key; Type: string; Params: T["Params"] }>({
         key,
         params: this.params as BuildSqlParams<T["Params"]>,
         build: (context, options) => {
            context.addStrings(`(`);
            this.query.build(context, options);
            context.addStrings(` FOR JSON AUTO `, `)`);

            context.addStrings(`as "${key}"`);
         },
      });
   }
}

function testCharm<T extends { Row?: unknown; Params?: unknown }>(query: SqlQuery<T>): TestCharm<T> {
   return new TestCharm<T>(query);
}

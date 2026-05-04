import { describe, expect, test } from "vitest";
import { findTables } from "#/schema/find-tables.js";

describe("Find Tables tests", () => {
   test("Find Tables query should match expected SQL", () => {
      const { text, values } = findTables.getSql({
         params: { schemas: ["public"] },
         options: { dialect: "postgresql" },
      });
      expect(text).toMatchInlineSnapshot(`
        "/* <query_0> */
        WITH
          "query_1" AS (
            /* <query_1> */
            SELECT
              "c_1"."table_name",
              "c_1"."table_schema",
              json_agg(
                "c_1"
                ORDER BY
                  "c_1"."ordinal_position"
              ) AS "columns"
            FROM
              "information_schema"."columns" AS "c_1"
            WHERE
              "c_1"."table_schema" IN ($1)
              AND "c_1"."table_name" IN (
                SELECT
                  table_name
                FROM
                  information_schema.tables
                WHERE
                  table_schema IN ($2)
                  AND table_type = 'BASE TABLE'
              )
            GROUP BY
              "c_1"."table_name",
              "c_1"."table_schema" /* </query_1> */
          ),
          "query_2" AS (
            /* <query_2> */
            SELECT
              "kcu_2"."table_name",
              "kcu_2"."table_schema",
              json_agg(
                "kcu_2"
                ORDER BY
                  "kcu_2"."ordinal_position"
              ) AS "primary_keys"
            FROM
              "information_schema"."key_column_usage" AS "kcu_2"
              JOIN "information_schema"."table_constraints" AS "tc_3" ON "kcu_2"."constraint_name" = "tc_3"."constraint_name"
              AND "kcu_2"."table_schema" = "tc_3"."table_schema"
            WHERE
              "tc_3"."constraint_type" = 'PRIMARY KEY'
              AND "tc_3"."table_schema" IN ($3)
            GROUP BY
              "kcu_2"."table_name",
              "kcu_2"."table_schema" /* </query_2> */
          )
        SELECT
          "query_1".*,
          "query_2"."primary_keys"
        FROM
          "query_1"
          LEFT JOIN "query_2" ON "query_1"."table_schema" = "query_2"."table_schema"
          AND "query_1"."table_name" = "query_2"."table_name" /* </query_0> */"
      `);

      expect(values).toMatchInlineSnapshot(`
        [
          "public",
          "public",
          "public",
        ]
      `);
   });
});

import { describe, expect, test } from "vitest";
import { findTables } from "#src/schema/find-tables.js";

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
          ),
          "query_3" AS (
            /* <query_3> */
            SELECT
              "kcu_4"."table_name",
              "kcu_4"."table_schema",
              json_agg(
                json_build_object(
                  'constraint_name',
                  "kcu_4"."constraint_name",
                  'column_name',
                  "kcu_4"."column_name",
                  'table_schema',
                  "kcu_4"."table_schema",
                  'table_name',
                  "kcu_4"."table_name",
                  'referenced_table_schema',
                  "referenced_key_column_usage"."table_schema",
                  'referenced_table_name',
                  "referenced_key_column_usage"."table_name",
                  'referenced_column_name',
                  "referenced_key_column_usage"."column_name",
                  'ordinal_position',
                  "kcu_4"."ordinal_position"
                )
                ORDER BY
                  "kcu_4"."ordinal_position"
              ) AS "foreign_keys"
            FROM
              "information_schema"."key_column_usage" AS "kcu_4"
              JOIN "information_schema"."table_constraints" AS "tc_5" ON "kcu_4"."constraint_name" = "tc_5"."constraint_name"
              AND "kcu_4"."table_schema" = "tc_5"."table_schema"
              JOIN "information_schema"."referential_constraints" AS "rc_6" ON "tc_5"."constraint_name" = "rc_6"."constraint_name"
              AND "tc_5"."table_schema" = "rc_6"."constraint_schema"
              JOIN "information_schema"."key_column_usage" AS "referenced_key_column_usage" ON "rc_6"."unique_constraint_name" = "referenced_key_column_usage"."constraint_name"
              AND "rc_6"."unique_constraint_schema" = "referenced_key_column_usage"."table_schema"
              AND "kcu_4"."position_in_unique_constraint" = "referenced_key_column_usage"."ordinal_position"
            WHERE
              "tc_5"."constraint_type" = 'FOREIGN KEY'
              AND "tc_5"."table_schema" IN ($4)
            GROUP BY
              "kcu_4"."table_name",
              "kcu_4"."table_schema" /* </query_3> */
          )
        SELECT
          "query_1".*,
          "query_2"."primary_keys",
          "query_3"."foreign_keys"
        FROM
          "query_1"
          LEFT JOIN "query_2" ON "query_1"."table_schema" = "query_2"."table_schema"
          AND "query_1"."table_name" = "query_2"."table_name"
          LEFT JOIN "query_3" ON "query_1"."table_schema" = "query_3"."table_schema"
          AND "query_1"."table_name" = "query_3"."table_name" /* </query_0> */"
      `);

      expect(values).toMatchInlineSnapshot(`
        [
          "public",
          "public",
          "public",
          "public",
        ]
      `);
      expect((text.match(/position_in_unique_constraint/g) ?? []).length).toBeGreaterThan(0);
   });
});

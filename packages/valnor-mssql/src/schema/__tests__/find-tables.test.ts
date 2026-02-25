import { describe, expect, test } from "vitest";
import { findTables } from "../find-tables.js";

describe("findTables() tests", () => {
   test("findTables() snapshot match", () => {
      const { text, values } = findTables.getSql({ params: { schemas: ["valnor_test"] } });
      expect(values).toMatchObject(["valnor_test", "valnor_test"]);
      expect(text).toMatchInlineSnapshot(`
        "/* <query_0> */
        SELECT
          "T_1"."TABLE_NAME" AS "table_name",
          "T_1"."TABLE_SCHEMA" AS "table_schema",
          "query_2"."primary_key",
          "table_columns_result"."table_columns" AS "table_columns"
        FROM
          "INFORMATION_SCHEMA"."TABLES" AS "T_1" OUTER APPLY (
            SELECT
              coalesce(
                (
                  /* <query_1> */
                  SELECT
                    "C_2"."COLUMN_NAME" AS "column_name",
                    "C_2"."COLUMN_DEFAULT" AS "column_default",
                    "C_2"."IS_NULLABLE" AS "is_nullable",
                    "C_2"."DATA_TYPE" AS "udt_name",
                    "C_2"."DOMAIN_NAME" AS "domain_name",
                    "C_2"."NUMERIC_PRECISION_RADIX" AS "numeric_precision_radix",
                    CASE
                      WHEN COLUMNPROPERTY (
                        OBJECT_ID ("C_2"."TABLE_SCHEMA" + '.' + "C_2"."TABLE_NAME"),
                        "C_2"."COLUMN_NAME",
                        'IsComputed'
                      ) = 1 THEN 'NO'
                      ELSE 'YES'
                    END AS "is_updatable"
                  FROM
                    "INFORMATION_SCHEMA"."COLUMNS" AS "C_2"
                  WHERE
                    "C_2"."TABLE_SCHEMA" = "T_1"."TABLE_SCHEMA"
                    AND "C_2"."TABLE_NAME" = "T_1"."TABLE_NAME"
                  ORDER BY
                    "C_2"."ORDINAL_POSITION"
                    /* </query_1> */
                    FOR json path,
                    include_null_values
                ),
                '[]'
              ) AS "table_columns"
          ) AS "table_columns_result"
          JOIN (
            /* <query_2> */
            SELECT DISTINCT
              "TC_3"."TABLE_SCHEMA" AS "table_schema",
              "TC_3"."TABLE_NAME" AS "table_name",
              "KCU_4"."COLUMN_NAME" AS "primary_key"
            FROM
              "INFORMATION_SCHEMA"."TABLE_CONSTRAINTS" AS "TC_3"
              JOIN "INFORMATION_SCHEMA"."KEY_COLUMN_USAGE" AS "KCU_4" ON "TC_3"."CONSTRAINT_NAME" = "KCU_4"."CONSTRAINT_NAME"
              AND "TC_3"."TABLE_SCHEMA" = "KCU_4"."TABLE_SCHEMA"
              AND "TC_3"."TABLE_NAME" = "KCU_4"."TABLE_NAME"
            WHERE
              "TC_3"."TABLE_SCHEMA" IN (?)
              AND "TC_3"."CONSTRAINT_TYPE" = 'PRIMARY KEY'
              /* </query_2> */
          ) AS "query_2" ON "T_1"."TABLE_SCHEMA" = "query_2"."table_schema"
          AND "T_1"."TABLE_NAME" = "query_2"."table_name"
        WHERE
          "T_1"."TABLE_SCHEMA" IN (?)
          AND "T_1"."TABLE_TYPE" = 'BASE TABLE'
        ORDER BY
          "T_1"."TABLE_SCHEMA",
          "T_1"."TABLE_NAME"
          /* </query_0> */"
      `);
   });
});

import { describe, expect, test } from "vitest";
import { findForeignKeys, findPrimaryKeys, findTables } from "#src/schema/find-tables.js";

describe("findTables() tests", () => {
   test("findTables() snapshot match", () => {
      const { text, values } = findTables.getSql({ params: { schemas: ["vexnor_dev"] } });
      expect(values).toMatchInlineSnapshot(`
        [
          "vexnor_dev",
        ]
      `);
      expect(text).toMatchInlineSnapshot(`
        "/* <query_0> */
        SELECT
          "T_1"."TABLE_NAME" AS "table_name",
          "T_1"."TABLE_SCHEMA" AS "table_schema",
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
                    "C_2"."DATA_TYPE" AS "data_type",
                    "C_2"."DOMAIN_NAME" AS "domain_name",
                    "C_2"."NUMERIC_PRECISION_RADIX" AS "numeric_precision_radix",
                    "C_2"."ORDINAL_POSITION" AS "ordinal_position",
                    /* <query_2> */
                    CASE
                      WHEN COLUMNPROPERTY (
                        OBJECT_ID ("C_2"."TABLE_SCHEMA" + '.' + "C_2"."TABLE_NAME"),
                        "C_2"."COLUMN_NAME",
                        'IsComputed'
                      ) = 1 THEN 'NO'
                      ELSE 'YES'
                    END /* </query_2> */ AS "is_updatable",
                    /* <query_3> */
                    CASE
                      WHEN COLUMNPROPERTY (
                        OBJECT_ID ("C_2"."TABLE_SCHEMA" + '.' + "C_2"."TABLE_NAME"),
                        "C_2"."COLUMN_NAME",
                        'IsComputed'
                      ) = 1 THEN 'ALWAYS'
                      ELSE 'NEVER'
                    END /* </query_3> */ AS "is_generated"
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
        WHERE
          "T_1"."TABLE_SCHEMA" IN (?)
          AND "T_1"."TABLE_TYPE" = 'BASE TABLE'
        ORDER BY
          "T_1"."TABLE_SCHEMA",
          "T_1"."TABLE_NAME" /* </query_0> */"
      `);
      expect((text.match(/\bJOIN\b/g) ?? []).length).toBe(0);
   });

   test("findForeignKeys() snapshot match", () => {
      const { text, values } = findForeignKeys.getSql({ params: { schemas: ["vexnor_dev"] } });
      expect(values).toMatchInlineSnapshot(`
        [
          "vexnor_dev",
        ]
      `);
      expect(text).toMatchInlineSnapshot(`
        "/* <query_0> */
        SELECT
          "KCU_1"."TABLE_SCHEMA" AS "table_schema",
          "KCU_1"."TABLE_NAME" AS "table_name",
          "KCU_1"."COLUMN_NAME" AS "column_name",
          "KCU_1"."CONSTRAINT_NAME" AS "constraint_name",
          "KCU_1"."ORDINAL_POSITION" AS "ordinal_position",
          "referenced_key_column_usage"."TABLE_SCHEMA" AS "referenced_table_schema",
          "referenced_key_column_usage"."TABLE_NAME" AS "referenced_table_name",
          "referenced_key_column_usage"."COLUMN_NAME" AS "referenced_column_name"
        FROM
          "INFORMATION_SCHEMA"."KEY_COLUMN_USAGE" AS "KCU_1"
          JOIN "INFORMATION_SCHEMA"."TABLE_CONSTRAINTS" AS "TC_2" ON "KCU_1"."CONSTRAINT_NAME" = "TC_2"."CONSTRAINT_NAME"
          AND "KCU_1"."TABLE_SCHEMA" = "TC_2"."TABLE_SCHEMA"
          JOIN "INFORMATION_SCHEMA"."REFERENTIAL_CONSTRAINTS" AS "RC_3" ON "TC_2"."CONSTRAINT_NAME" = "RC_3"."CONSTRAINT_NAME"
          AND "TC_2"."TABLE_SCHEMA" = "RC_3"."CONSTRAINT_SCHEMA"
          JOIN "INFORMATION_SCHEMA"."KEY_COLUMN_USAGE" AS "referenced_key_column_usage" ON "RC_3"."UNIQUE_CONSTRAINT_NAME" = "referenced_key_column_usage"."CONSTRAINT_NAME"
          AND "RC_3"."UNIQUE_CONSTRAINT_SCHEMA" = "referenced_key_column_usage"."TABLE_SCHEMA"
          AND "KCU_1"."ORDINAL_POSITION" = "referenced_key_column_usage"."ORDINAL_POSITION"
        WHERE
          "TC_2"."CONSTRAINT_TYPE" = 'FOREIGN KEY'
          AND "TC_2"."TABLE_SCHEMA" IN (?)
        ORDER BY
          "KCU_1"."TABLE_SCHEMA",
          "KCU_1"."TABLE_NAME",
          "KCU_1"."CONSTRAINT_NAME",
          "KCU_1"."ORDINAL_POSITION" /* </query_0> */"
      `);
      expect((text.match(/ORDINAL_POSITION/g) ?? []).length).toBeGreaterThan(0);
   });

   test("findPrimaryKeys() snapshot match", () => {
      const { text, values } = findPrimaryKeys.getSql({ params: { schemas: ["vexnor_dev"] } });
      expect(values).toMatchInlineSnapshot(`
        [
          "vexnor_dev",
        ]
      `);
      expect(text).toMatchInlineSnapshot(`
        "/* <query_0> */
        SELECT
          "TC_1"."TABLE_SCHEMA" AS "table_schema",
          "TC_1"."TABLE_NAME" AS "table_name",
          "KCU_2"."CONSTRAINT_NAME" AS "constraint_name",
          "KCU_2"."COLUMN_NAME" AS "column_name",
          "KCU_2"."ORDINAL_POSITION" AS "ordinal_position"
        FROM
          "INFORMATION_SCHEMA"."TABLE_CONSTRAINTS" AS "TC_1"
          JOIN "INFORMATION_SCHEMA"."KEY_COLUMN_USAGE" AS "KCU_2" ON "TC_1"."CONSTRAINT_NAME" = "KCU_2"."CONSTRAINT_NAME"
          AND "TC_1"."TABLE_SCHEMA" = "KCU_2"."TABLE_SCHEMA"
          AND "TC_1"."TABLE_NAME" = "KCU_2"."TABLE_NAME"
        WHERE
          "TC_1"."TABLE_SCHEMA" IN (?)
          AND "TC_1"."CONSTRAINT_TYPE" = 'PRIMARY KEY'
        ORDER BY
          "TC_1"."TABLE_SCHEMA",
          "TC_1"."TABLE_NAME",
          "KCU_2"."CONSTRAINT_NAME",
          "KCU_2"."ORDINAL_POSITION" /* </query_0> */"
      `);
   });
});

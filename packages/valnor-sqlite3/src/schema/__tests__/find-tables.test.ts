import { describe, expect, test } from "vitest";
import { findTables, findTableColumns, findPrimaryKeys } from "../find-tables.js";

describe("Find Tables tests", () => {
   test("Find Tables query should match expected SQL", () => {
      const { text, values } = findTables.getSql({ options: { dialect: "sqlite" } });
      expect(values).toMatchInlineSnapshot(`[]`);
      expect(text).toMatchInlineSnapshot(`
        "SELECT
          "sm_1"."name" AS "table_name",
          'main' AS "table_schema",
          '[]' AS "table_columns",
          NULL AS "primary_key"
        FROM
          "sqlite_master" AS "sm_1"
        WHERE
          "sm_1"."type" = 'table'
          AND "sm_1"."name" NOT LIKE 'sqlite_%'"
      `);
   });

   test("Find Table Columns query should match expected SQL", () => {
      const { text, values } = findTableColumns.getSql({
         params: { tableName: "account" },
         options: { dialect: "sqlite" },
      });
      expect(values).toMatchInlineSnapshot(`
        [
          "account",
        ]
      `);
      expect(text).toMatchInlineSnapshot(`
        "SELECT
          "pti_1"."name" AS "column_name",
          "pti_1"."dflt_value" AS "column_default",
          "pti_1"."type" AS "udt_name",
          CASE
            WHEN "notnull" = 0 THEN 'YES'
            ELSE 'NO'
          END AS "is_nullable",
          'YES' AS "is_updatable"
        FROM
          pragma_table_info (?) AS "pti_1""
      `);
   });

   test("Find Primary Keys query should match expected SQL", () => {
      const { text, values } = findPrimaryKeys.getSql({
         params: { tableName: "account" },
         options: { dialect: "sqlite" },
      });
      expect(values).toMatchInlineSnapshot(`
        [
          "account",
        ]
      `);
      expect(text).toMatchInlineSnapshot(`
        "SELECT
          "pti_1"."name" AS "column_name",
          "pti_1"."name" AS "constraint_name",
          "pti_1"."cid" AS "ordinal_position"
        FROM
          pragma_table_info (?) AS "pti_1"
        WHERE
          pk = 1"
      `);
   });
});

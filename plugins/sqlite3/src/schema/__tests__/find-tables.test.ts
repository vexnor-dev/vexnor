import { describe, expect, test } from "vitest";
import { findTables, findTableColumns, findPrimaryKeys, findForeignKeys } from "#src/schema/find-tables.js";

describe("Find Tables tests", () => {
   test("Find Tables query should match expected SQL", () => {
      const { text, values } = findTables.getSql({ options: { dialect: "sqlite" } });
      expect(values).toMatchInlineSnapshot(`[]`);
      expect(text).toMatchInlineSnapshot(`
        "/* <query_0> */
        SELECT
          "sm_1"."name" AS "table_name",
          'main' AS "table_schema",
          '[]' AS "table_columns",
          NULL AS "primary_key"
        FROM
          "sqlite_master" AS "sm_1"
        WHERE
          "sm_1"."type" = 'table'
          AND "sm_1"."name" NOT LIKE 'sqlite_%'
          /* </query_0> */"
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
        "/* <query_0> */
        SELECT
          "pti_1"."name" AS "column_name",
          "pti_1"."dflt_value" AS "column_default",
          "pti_1"."type" AS "udt_name",
          "pti_1"."type" AS "data_type",
          /* <query_1> */
          "pti_1"."cid" + 1 /* </query_1> */ AS "ordinal_position",
          /* <query_2> */
          CASE
            WHEN "notnull" = 0 THEN 'YES'
            ELSE 'NO'
          END /* </query_2> */ AS "is_nullable",
          /* <query_3> */
          'YES' /* </query_3> */ AS "is_updatable"
        FROM
          pragma_table_info (?) AS "pti_1"
          /* </query_0> */"
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
        "/* <query_0> */
        SELECT
          "pti_1"."name" AS "column_name",
          "pti_1"."pk" AS "ordinal_position",
          /* <query_1> */
          'primary' /* </query_1> */ AS "constraint_name"
        FROM
          pragma_table_info (?) AS "pti_1"
        WHERE
          "pti_1"."pk" > 0
          /* </query_0> */"
      `);
      expect((text.match(/"pk" > 0/g) ?? []).length).toBe(1);
   });

   test("Find Foreign Keys query should match expected SQL", () => {
      const { text, values } = findForeignKeys.getSql({
         params: { tableName: "account" },
         options: { dialect: "sqlite" },
      });
      expect(values).toMatchInlineSnapshot(`
        [
          "account",
        ]
      `);
      expect(text).toMatchInlineSnapshot(`
        "/* <query_0> */
        SELECT
          "pfkl_1"."id",
          "pfkl_1"."seq",
          "pfkl_1"."table" AS "referenced_table_name",
          "pfkl_1"."from" AS "column_name",
          "pfkl_1"."to" AS "referenced_column_name"
        FROM
          pragma_foreign_key_list (?) AS "pfkl_1"
          /* </query_0> */"
      `);
   });
});

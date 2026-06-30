import { describe, expect, test } from "vitest";
import { findEnums } from "#src/schema/find-enums.js";

describe("Find Enums tests", () => {
   test("Find Enums query should match expected SQL", () => {
      const { text, values } = findEnums.getSql({ params: { schemas: ["public"] } });
      expect(values).toEqual(["public"]);
      expect(text).toMatchInlineSnapshot(`
        "/* <query_0> */
        WITH
          "enum_values" AS (
            SELECT
              "pe_1"."oid",
              "pe_1"."enumtypid",
              "pe_1"."enumlabel" AS "enum_label",
              "pe_1"."enumsortorder"
            FROM
              "pg_catalog"."pg_enum" AS "pe_1"
          )
        SELECT
          "pt_2"."typname" AS "enum_name",
          "pn_3"."nspname" AS "enum_schema",
          /* <query_1> */ json_agg ("enum_values") /* </query_1> */ AS "enum_values"
        FROM
          "pg_catalog"."pg_type" AS "pt_2"
          JOIN "enum_values" ON "pt_2"."oid" = "enum_values"."enumtypid"
          JOIN "pg_catalog"."pg_namespace" AS "pn_3" ON "pn_3"."oid" = "pt_2"."typnamespace"
        WHERE
          "pt_2"."typcategory" = 'E'
          AND "pn_3"."nspname" IN (?)
        GROUP BY
          "pt_2"."oid",
          "pt_2"."typname",
          "pt_2"."typelem",
          "pn_3"."nspname" /* </query_0> */"
      `);
   });
});

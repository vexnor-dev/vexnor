import { describe, expect, test } from "vitest";
import { findTables } from "../find-tables.js";
import "valnor/testing";

describe("Find Tables tests", () => {
   test("Find Tables query should match expected SQL", () => {
      const query = findTables.getSql({ params: { schemas: ["public"] } });

      expect(query).toEqualQuery(`
         with cols as (select "c_1"."table_name",
                              "c_1"."table_schema",
                              "c_1"."column_name",
                              "c_1"."data_type",
                              "c_1"."is_nullable",
                              "c_1"."column_default",
                              "c_1"."character_maximum_length",
                              "c_1"."numeric_precision",
                              "c_1"."numeric_scale",
                              "c_1"."is_identity",
                              "c_1"."identity_generation",
                              "c_1"."identity_start",
                              "c_1"."identity_increment",
                              "c_1"."identity_maximum",
                              "c_1"."identity_minimum",
                              "c_1"."identity_cycle",
                              "c_1"."is_generated",
                              "c_1"."generation_expression",
                              "c_1"."is_updatable",
                              "c_1"."ordinal_position",
                              "c_1"."udt_name"
                       from "information_schema"."columns" as "c_1"
                       where "c_1"."table_schema" in (?))
         select "cols"."table_name",
                "cols"."table_schema",
                json_agg("cols" order by "cols"."ordinal_position") as table_columns,
                "tc_2"."constraint_name"                             as primary_key
         from cols
                 left join "information_schema"."table_constraints" as "tc_2"
                           on "cols"."table_name" = "tc_2"."table_name" and "tc_2"."constraint_type" = 'PRIMARY KEY'
         group by "cols"."table_name", "cols"."table_schema",
                  "tc_2"."constraint_name"
      `);
   });
});

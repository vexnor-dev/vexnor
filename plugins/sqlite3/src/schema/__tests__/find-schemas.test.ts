import { describe, expect, test } from "vitest";
import { findSchemas } from "#src/schema/find-schemas.js";

describe("findSchemas", () => {
   test("renders the typed SQLite database-list query", () => {
      const { text, values } = findSchemas.getSql({ options: { dialect: "sqlite" } });

      expect(text).toMatchInlineSnapshot(`
        "/* <query_0> */
        SELECT
          "pdl_1"."name"
        FROM
          pragma_database_list AS "pdl_1"
        ORDER BY
          "pdl_1"."seq" /* </query_0> */"
      `);
      expect(values).toMatchInlineSnapshot(`[]`);
   });
});

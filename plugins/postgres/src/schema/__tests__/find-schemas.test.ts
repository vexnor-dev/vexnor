import { describe, expect, test } from "vitest";
import { findSchemas } from "#src/schema/find-schemas.js";

describe("findSchemas", () => {
   test("renders the typed PostgreSQL namespace query", () => {
      const { text, values } = findSchemas.getSql({ options: { dialect: "postgresql" } });

      expect(text).toMatchInlineSnapshot(`
        "/* <query_0> */
        SELECT
          "pn_1"."nspname" AS "name"
        FROM
          "pg_catalog"."pg_namespace" AS "pn_1"
        ORDER BY
          "pn_1"."nspname" /* </query_0> */"
      `);
      expect(values).toMatchInlineSnapshot(`[]`);
   });
});

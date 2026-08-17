import { describe, expect, test } from "vitest";
import { findSchemas } from "#src/schema/find-schemas.js";

describe("findSchemas", () => {
   test("renders the typed SQL Server schema query", () => {
      const { text, values } = findSchemas.getSql({});

      expect(text).toMatchInlineSnapshot(`
        "/* <query_0> */
        SELECT
          "s_1"."name"
        FROM
          "sys"."schemas" AS "s_1"
        ORDER BY
          "s_1"."name" /* </query_0> */"
      `);
      expect(values).toMatchInlineSnapshot(`[]`);
   });
});

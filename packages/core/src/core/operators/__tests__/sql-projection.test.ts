import { describe, expect, test } from "vitest";
import { sqlSelect } from "#src/core/crud/sql-select.js";
import { Account } from "@test-models/vexnor_dev.schema.js";

function buildWithSelect(selectData: unknown) {
   const query = sqlSelect(Account, {});
   return query.getSql({ params: { select: selectData as never }, options: { dialect: "sqlite" } });
}

describe("SqlProjection — runtime column selection", () => {
   describe("column selection by name (keyof)", () => {
      test("single column", () => {
         const { text, values } = buildWithSelect(["accountId"]);
         expect(text).toMatchInlineSnapshot(`
           "/* <query_0> */
           SELECT
             "a_1"."account_id" AS "accountId"
           FROM
             "main"."account" AS "a_1"
             /* <query_1> */
             /* </query_1> */
             /* <query_2> */
             /* </query_2> */
             /* </query_0> */"
         `);
         expect(values).toMatchInlineSnapshot(`[]`);
      });

      test("multiple columns", () => {
         const { text, values } = buildWithSelect(["accountId", "email", "status"]);
         expect(text).toMatchInlineSnapshot(`
           "/* <query_0> */
           SELECT
             "a_1"."account_id" AS "accountId",
             "a_1"."email",
             "a_1"."status"
           FROM
             "main"."account" AS "a_1"
             /* <query_1> */
             /* </query_1> */
             /* <query_2> */
             /* </query_2> */
             /* </query_0> */"
         `);
         expect(values).toMatchInlineSnapshot(`[]`);
      });
   });

   describe("aggregate functions", () => {
      test("count(*)", () => {
         const { text, values } = buildWithSelect(["status", ["count", "*", "total"]]);
         expect(text).toMatchInlineSnapshot(`
           "/* <query_0> */
           SELECT
             "a_1"."status",
             count(*) AS "total"
           FROM
             "main"."account" AS "a_1"
             /* <query_1> */
             /* </query_1> */
             /* <query_2> */
           GROUP BY
             "a_1"."status" /* </query_2> */
             /* </query_0> */"
         `);
         expect(values).toMatchInlineSnapshot(`[]`);
      });

      test("sum with keyof column", () => {
         const { text, values } = buildWithSelect(["status", ["sum", "createdAt", "totalCreated"]]);
         expect(text).toMatchInlineSnapshot(`
           "/* <query_0> */
           SELECT
             "a_1"."status",
             sum("a_1"."created_at") AS "totalCreated"
           FROM
             "main"."account" AS "a_1"
             /* <query_1> */
             /* </query_1> */
             /* <query_2> */
           GROUP BY
             "a_1"."status" /* </query_2> */
             /* </query_0> */"
         `);
         expect(values).toMatchInlineSnapshot(`[]`);
      });


      test("min and max", () => {
         const { text, values } = buildWithSelect([
            "status",
            ["min", "createdAt", "earliest"],
            ["max", "createdAt", "latest"],
         ]);
         expect(text).toMatchInlineSnapshot(`
           "/* <query_0> */
           SELECT
             "a_1"."status",
             min("a_1"."created_at") AS "earliest",
             max("a_1"."created_at") AS "latest"
           FROM
             "main"."account" AS "a_1"
             /* <query_1> */
             /* </query_1> */
             /* <query_2> */
           GROUP BY
             "a_1"."status" /* </query_2> */
             /* </query_0> */"
         `);
         expect(values).toMatchInlineSnapshot(`[]`);
      });
   });

   describe("auto GROUP BY", () => {
      test("GROUP BY emitted when aggregates present", () => {
         const { text } = buildWithSelect(["status", ["count", "*", "total"]]);
         expect(text).toMatchInlineSnapshot(`
           "/* <query_0> */
           SELECT
             "a_1"."status",
             count(*) AS "total"
           FROM
             "main"."account" AS "a_1"
             /* <query_1> */
             /* </query_1> */
             /* <query_2> */
           GROUP BY
             "a_1"."status" /* </query_2> */
             /* </query_0> */"
         `);
      });

      test("no GROUP BY when no aggregates", () => {
         const { text } = buildWithSelect(["accountId", "email"]);
         expect(text).toMatchInlineSnapshot(`
           "/* <query_0> */
           SELECT
             "a_1"."account_id" AS "accountId",
             "a_1"."email"
           FROM
             "main"."account" AS "a_1"
             /* <query_1> */
             /* </query_1> */
             /* <query_2> */
             /* </query_2> */
             /* </query_0> */"
         `);
      });
   });

   describe("fallback — no select param", () => {
      test("emits all columns when select is undefined", () => {
         const query = sqlSelect(Account, {});
         const { text } = query.getSql({ params: {}, options: { dialect: "sqlite" } });
         expect(text).toMatchInlineSnapshot(`
           "/* <query_0> */
           SELECT
             "a_1"."account_id" AS "accountId",
             "a_1"."status",
             "a_1"."email",
             "a_1"."first_name" AS "firstName",
             "a_1"."last_name" AS "lastName",
             "a_1"."notes",
             "a_1"."created_at" AS "createdAt",
             "a_1"."modified_at" AS "modifiedAt",
             "a_1"."parent_id" AS "parentId"
           FROM
             "main"."account" AS "a_1"
             /* <query_1> */
             /* </query_1> */
             /* <query_2> */
             /* </query_2> */
             /* </query_0> */"
         `);
      });

      test("emits all columns when select is empty array", () => {
         const { text } = buildWithSelect([]);
         expect(text).toMatchInlineSnapshot(`
           "/* <query_0> */
           SELECT
             "a_1"."account_id" AS "accountId",
             "a_1"."status",
             "a_1"."email",
             "a_1"."first_name" AS "firstName",
             "a_1"."last_name" AS "lastName",
             "a_1"."notes",
             "a_1"."created_at" AS "createdAt",
             "a_1"."modified_at" AS "modifiedAt",
             "a_1"."parent_id" AS "parentId"
           FROM
             "main"."account" AS "a_1"
             /* <query_1> */
             /* </query_1> */
             /* <query_2> */
             /* </query_2> */
             /* </query_0> */"
         `);
      });
   });

   describe("error handling", () => {
      test("throws on unknown column name", () => {
         expect(() => buildWithSelect(["badColumn"])).toThrow("Column not found: badColumn");
      });

      test("throws on invalid aggregate function", () => {
         expect(() => buildWithSelect([["badFn", "*", "x"]])).toThrow("Invalid aggregate function: badFn");
      });

      test("throws on aggregate without alias", () => {
         expect(() => buildWithSelect([["count", "*"]])).toThrow("requires an alias");
      });

      test("throws on invalid entry type", () => {
         expect(() => buildWithSelect([123])).toThrow("Invalid select entry");
      });
   });
});


describe("SqlProjectBy — serialization and error branches", () => {
   test("serializes to projection operator token when params=null", async () => {
      const { serializeQuery } = await import("#src/core/serialize/serialize-query.js");
      const { SqlProjectBy } = await import("#src/core/operators/sql-project-by.js");
      const { Account } = await import("@test-models/vexnor_dev.schema.js");
      const { sql } = await import("#src/core/sql.js");

      const projection = new SqlProjectBy(Account, "select");
      const query = sql`SELECT ${projection} FROM ${Account}`;
      const result = await serializeQuery(query, "projectionTest", "postgresql");
      const projNode = result.template.find((n) => n.type === "projection");
      expect(projNode).toBeDefined();
      expect(projNode!.type).toBe("projection");
   });

   test("throws on invalid column reference in aggregate", async () => {
      const { SqlProjectBy } = await import("#src/core/operators/sql-project-by.js");
      const { Account } = await import("@test-models/vexnor_dev.schema.js");
      const { sql } = await import("#src/core/sql.js");

      const projection = new SqlProjectBy(Account, "select");
      const query = sql`SELECT ${projection} FROM ${Account}`;
      expect(() =>
         query.getSql({ params: { select: [["sum", 123, "total"]] } }),
      ).toThrow("Invalid column reference in aggregate");
   });
});

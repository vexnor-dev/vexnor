import { describe, expect, test } from "vitest";
import { sqlSelect } from "#src/core/crud/sql-select.js";
import { Account } from "@test-models/vexnor_dev.schema.js";
import { havingBy, SqlHavingBy } from "#src/core/operators/sql-having-by.js";
import { SqlBuildContext } from "#src/core/builder/sql-build-context.js";

function buildWithHaving(selectData: unknown, havingData: unknown) {
   const query = sqlSelect(Account, {});
   return query.getSql({ params: { select: selectData as never, havingBy: havingData as never }, options: { dialect: "sqlite" } });
}

describe("SqlHavingBy — runtime HAVING filter on aggregate aliases", () => {
   describe("basic conditions", () => {
      test("equality on aggregate alias", () => {
         const { text, values } = buildWithHaving(
            { status: true, total: { fn: "count", col: "*" } },
            [{ total: 5 }],
         );
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
             /* <query_3> */
           HAVING
             count(*) = ? /* </query_3> */
             /* </query_0> */"
         `);
         expect(values).toMatchInlineSnapshot(`
           [
             5,
           ]
         `);
      });

      test("greater than operator", () => {
         const { text, values } = buildWithHaving(
            { status: true, total: { fn: "count", col: "*" } },
            [{ total: [">", 10] }],
         );
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
             /* <query_3> */
           HAVING
             count(*) > ? /* </query_3> */
             /* </query_0> */"
         `);
         expect(values).toMatchInlineSnapshot(`
           [
             10,
           ]
         `);
      });

      test("less than or equal operator", () => {
         const { text, values } = buildWithHaving(
            { status: true, totalCreated: { fn: "sum", col: "createdAt" } },
            [{ totalCreated: ["<=", 100] }],
         );
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
             /* <query_3> */
           HAVING
             sum("a_1"."created_at") <= ? /* </query_3> */
             /* </query_0> */"
         `);
         expect(values).toMatchInlineSnapshot(`
           [
             100,
           ]
         `);
      });

      test("between operator", () => {
         const { text, values } = buildWithHaving(
            { status: true, total: { fn: "count", col: "*" } },
            [{ total: ["between", 5, 20] }],
         );
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
             /* <query_3> */
           HAVING
             count(*) BETWEEN ? AND ?  /* </query_3> */
             /* </query_0> */"
         `);
         expect(values).toMatchInlineSnapshot(`
           [
             5,
             20,
           ]
         `);
      });

      test("in operator", () => {
         const { text, values } = buildWithHaving(
            { status: true, total: { fn: "count", col: "*" } },
            [{ total: ["in", 1, 2, 3] }],
         );
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
             /* <query_3> */
           HAVING
             count(*) IN (?, ?, ?) /* </query_3> */
             /* </query_0> */"
         `);
         expect(values).toMatchInlineSnapshot(`
           [
             1,
             2,
             3,
           ]
         `);
      });
   });

   describe("multiple conditions", () => {
      test("AND multiple aggregate conditions", () => {
         const { text, values } = buildWithHaving(
            { status: true, total: { fn: "count", col: "*" }, sumCreated: { fn: "sum", col: "createdAt" } },
            [{ total: [">", 5] }, { sumCreated: ["<", 100] }],
         );
         expect(text).toMatchInlineSnapshot(`
           "/* <query_0> */
           SELECT
             "a_1"."status",
             count(*) AS "total",
             sum("a_1"."created_at") AS "sumCreated"
           FROM
             "main"."account" AS "a_1"
             /* <query_1> */
             /* </query_1> */
             /* <query_2> */
           GROUP BY
             "a_1"."status" /* </query_2> */
             /* <query_3> */
           HAVING
             count(*) > ?
             AND sum("a_1"."created_at") < ? /* </query_3> */
             /* </query_0> */"
         `);
         expect(values).toMatchInlineSnapshot(`
           [
             5,
             100,
           ]
         `);
      });
   });

   describe("no havingBy param", () => {
      test("emits nothing when havingBy is undefined", () => {
         const query = sqlSelect(Account, {});
         const { text } = query.getSql({
            params: { select: { status: true, total: { fn: "count", col: "*" } } as never },
            options: { dialect: "sqlite" },
         });
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
             /* <query_3> */
             /* </query_3> */
             /* </query_0> */"
         `);
      });

      test("emits nothing when havingBy is null", () => {
         const query = sqlSelect(Account, {});
         const { text } = query.getSql({
            params: { select: { status: true, total: { fn: "count", col: "*" } } as never, havingBy: null as never },
            options: { dialect: "sqlite" },
         });
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
             /* <query_3> */
             /* </query_3> */
             /* </query_0> */"
         `);
      });

      test("emits nothing when havingBy is empty array", () => {
         const { text } = buildWithHaving(
            { status: true, total: { fn: "count", col: "*" } },
            [],
         );
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
             /* <query_3> */
             /* </query_3> */
             /* </query_0> */"
         `);
      });
   });

   describe("error handling", () => {
      test("throws when alias not found in select aggregates", () => {
         expect(() => buildWithHaving(
            { status: true, total: { fn: "count", col: "*" } },
            [{ badAlias: [">", 10] }],
         )).toThrow("alias 'badAlias' not found in select aggregates");
      });

      test("throws when no aggregates in select", () => {
         expect(() => buildWithHaving(
            { status: true, email: true },
            [{ total: [">", 10] }],
         )).toThrow("havingBy requires aggregate columns in the select param");
      });

      test("throws on invalid operator", () => {
         expect(() => buildWithHaving(
            { status: true, total: { fn: "count", col: "*" } },
            [{ total: ["badOp", 10] }],
         )).toThrow("Invalid havingBy operator: badOp");
      });

      test("throws on non-primitive bare value", () => {
         expect(() => buildWithHaving(
            { status: true, total: { fn: "count", col: "*" } },
            [{ total: { nested: true } }],
         )).toThrow("havingBy value is not a primitive");
      });
   });

   describe("additional operators", () => {
      test("not equal operator (!=)", () => {
         const { text, values } = buildWithHaving(
            { status: true, total: { fn: "count", col: "*" } },
            [{ total: ["!=", 0] }],
         );
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
             /* <query_3> */
           HAVING
             count(*) <> ? /* </query_3> */
             /* </query_0> */"
         `);
         expect(values).toMatchInlineSnapshot(`
           [
             0,
           ]
         `);
      });

      test("not operator (alias for !=)", () => {
         const { text, values } = buildWithHaving(
            { status: true, total: { fn: "count", col: "*" } },
            [{ total: ["not", 3] }],
         );
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
             /* <query_3> */
           HAVING
             count(*) <> ? /* </query_3> */
             /* </query_0> */"
         `);
         expect(values).toMatchInlineSnapshot(`
           [
             3,
           ]
         `);
      });

      test(">= operator", () => {
         const { text, values } = buildWithHaving(
            { status: true, total: { fn: "count", col: "*" } },
            [{ total: [">=", 5] }],
         );
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
             /* <query_3> */
           HAVING
             count(*) >= ? /* </query_3> */
             /* </query_0> */"
         `);
         expect(values).toMatchInlineSnapshot(`
           [
             5,
           ]
         `);
      });

      test("notIn with values", () => {
         const { text, values } = buildWithHaving(
            { status: true, total: { fn: "count", col: "*" } },
            [{ total: ["notIn", 1, 2, 3] }],
         );
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
             /* <query_3> */
           HAVING
             count(*) NOT IN (?, ?, ?) /* </query_3> */
             /* </query_0> */"
         `);
         expect(values).toMatchInlineSnapshot(`
           [
             1,
             2,
             3,
           ]
         `);
      });

      test("notIn with empty args emits is not null", () => {
         const { text, values } = buildWithHaving(
            { status: true, total: { fn: "count", col: "*" } },
            [{ total: ["notIn"] }],
         );
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
             /* <query_3> */
           HAVING
             count(*) IS NOT NULL /* </query_3> */
             /* </query_0> */"
         `);
         expect(values).toMatchInlineSnapshot(`[]`);
      });

      test("like operator", () => {
         const { text, values } = buildWithHaving(
            { status: true, total: { fn: "count", col: "*" } },
            [{ total: ["like", "%5%"] }],
         );
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
             /* <query_3> */
           HAVING
             count(*) like ? /* </query_3> */
             /* </query_0> */"
         `);
         expect(values).toMatchInlineSnapshot(`
           [
             "%5%",
           ]
         `);
      });

      test("notLike operator", () => {
         const { text, values } = buildWithHaving(
            { status: true, total: { fn: "count", col: "*" } },
            [{ total: ["notLike", "%0%"] }],
         );
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
             /* <query_3> */
           HAVING
             count(*) NOT like ? /* </query_3> */
             /* </query_0> */"
         `);
         expect(values).toMatchInlineSnapshot(`
           [
             "%0%",
           ]
         `);
      });

      test("isNull operator", () => {
         const { text, values } = buildWithHaving(
            { status: true, total: { fn: "count", col: "*" } },
            [{ total: ["isNull"] }],
         );
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
             /* <query_3> */
           HAVING
             count(*) IS NULL /* </query_3> */
             /* </query_0> */"
         `);
         expect(values).toMatchInlineSnapshot(`[]`);
      });

      test("isNotNull operator", () => {
         const { text, values } = buildWithHaving(
            { status: true, total: { fn: "count", col: "*" } },
            [{ total: ["isNotNull"] }],
         );
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
             /* <query_3> */
           HAVING
             count(*) IS NOT NULL /* </query_3> */
             /* </query_0> */"
         `);
         expect(values).toMatchInlineSnapshot(`[]`);
      });

      test("between with empty args emits is null", () => {
         const { text, values } = buildWithHaving(
            { status: true, total: { fn: "count", col: "*" } },
            [{ total: ["between"] }],
         );
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
             /* <query_3> */
           HAVING
             count(*) IS NULL /* </query_3> */
             /* </query_0> */"
         `);
         expect(values).toMatchInlineSnapshot(`[]`);
      });

      test("in with empty args emits is null", () => {
         const { text, values } = buildWithHaving(
            { status: true, total: { fn: "count", col: "*" } },
            [{ total: ["in"] }],
         );
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
             /* <query_3> */
           HAVING
             count(*) IS NULL /* </query_3> */
             /* </query_0> */"
         `);
         expect(values).toMatchInlineSnapshot(`[]`);
      });
   });

   describe("column resolution branches", () => {
      test("aggregate on column with table prefix (dot notation)", () => {
         const { text, values } = buildWithHaving(
            { status: true, totalEmail: { fn: "count", col: "account.email" } },
            [{ totalEmail: [">", 1] }],
         );
         expect(text).toMatchInlineSnapshot(`
           "/* <query_0> */
           SELECT
             "a_1"."status",
             count("a_1"."email") AS "totalEmail"
           FROM
             "main"."account" AS "a_1"
             /* <query_1> */
             /* </query_1> */
             /* <query_2> */
           GROUP BY
             "a_1"."status" /* </query_2> */
             /* <query_3> */
           HAVING
             count("a_1"."email") > ? /* </query_3> */
             /* </query_0> */"
         `);
         expect(values).toMatchInlineSnapshot(`
           [
             1,
           ]
         `);
      });

      test("fallback to raw quoted identifier for unknown column", () => {
         const op = new SqlHavingBy(Account, "havingBy", "select");
         const context = new SqlBuildContext({
            dialect: "sqlite",
            params: {
               select: { status: true, totalUnknown: { fn: "count", col: "totallyFakeCol" } },
               havingBy: [{ totalUnknown: [">", 0] }],
            },
         });
         op.write(context);
         expect(context.text).toMatchInlineSnapshot(`
           "HAVING
             count("totallyFakeCol") > ?"
         `);
      });

      test("throws when column not found in havingBy aggregate (context has columns)", () => {
         const op = new SqlHavingBy(Account, "havingBy", "select");
         const context = new SqlBuildContext({
            dialect: "sqlite",
            params: {
               select: { status: true, totalBad: { fn: "count", col: "nonExistent" } },
               havingBy: [{ totalBad: [">", 1] }],
            },
         });
         // Populate columns in context to trigger the columnCount > 0 branch
         context.addColumns({ "email": Account.cols.$email });
         expect(() => op.write(context)).toThrow("Column not found in havingBy aggregate: nonExistent");
      });

      test("explicit equals operator in array form", () => {
         const { text, values } = buildWithHaving(
            { status: true, total: { fn: "count", col: "*" } },
            [{ total: ["=", 5] }],
         );
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
             /* <query_3> */
           HAVING
             count(*) = ? /* </query_3> */
             /* </query_0> */"
         `);
         expect(values).toMatchInlineSnapshot(`
           [
             5,
           ]
         `);
      });
   });

   describe("havingBy factory", () => {
      test("havingBy() factory creates instance with default param name", () => {
         const instance = havingBy(Account);
         expect(instance.paramName).toBe("havingBy");
         expect(instance.table).toBe(Account);
      });

      test("havingBy() factory accepts custom param name", () => {
         const instance = havingBy(Account, "customHaving");
         expect(instance.paramName).toBe("customHaving");
      });

      test("havingBy() factory accepts custom select param name", () => {
         const instance = havingBy(Account, "havingBy", "customSelect");
         expect(instance.selectParamName).toBe("customSelect");
      });
   });

   describe("serialization and metadata", () => {
      test("emits operator token when context.params is null", () => {
         const op = new SqlHavingBy(Account, "havingBy", "select");
         const context = new SqlBuildContext({ dialect: "sqlite", params: null });
         op.write(context);
         const opToken = context.tokens.find((t) => t.type === "operator");
         expect(opToken).toMatchInlineSnapshot(`
           {
             "operator": {
               "param": "havingBy",
               "type": "havingBy",
             },
             "type": "operator",
           }
         `);
      });

      test("aiPrompt getter returns description string", () => {
         const op = new SqlHavingBy(Account, "havingBy", "select");
         expect(op.aiPrompt).toMatchInlineSnapshot(`"havingBy: [{alias: value}] or [{alias: ["op", ...args]}]. Filter on aggregate aliases from select. Ops: =, !=, >, >=, <, <=, between, in, notIn. Alias must match a key in select that has an aggregate fn."`);
      });
   });

   describe("direct column resolution (no context columns)", () => {
      test("resolves column directly from table when context has no columns", () => {
         const op = new SqlHavingBy(Account, "havingBy", "select");
         const context = new SqlBuildContext({
            dialect: "sqlite",
            params: {
               select: { status: true, totalEmail: { fn: "count", col: "email" } },
               havingBy: [{ totalEmail: [">", 0] }],
            },
         });
         op.write(context);
         expect(context.text).toMatchInlineSnapshot(`
           "HAVING
             count("a_1"."email") > ?"
         `);
      });
   });

   describe("skips undefined values", () => {
      test("skips undefined values in condition entries", () => {
         const { text, values } = buildWithHaving(
            { status: true, total: { fn: "count", col: "*" } },
            [{ total: undefined }],
         );
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
             /* <query_3> */
           HAVING
             /* </query_3> */
             /* </query_0> */"
         `);
         expect(values).toMatchInlineSnapshot(`[]`);
      });
   });
});

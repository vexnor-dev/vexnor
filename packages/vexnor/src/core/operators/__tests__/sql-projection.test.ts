import { describe, expect, test } from "vitest";
import { sqlSelect } from "#src/core/crud/sql-select.js";
import { Account } from "@test-models/vexnor_dev.schema.js";

function buildWithSelect(selectData: unknown, dialect: "sqlite" | "postgresql" | "transactsql" = "sqlite") {
   const query = sqlSelect(Account, {});
   return query.getSql({ params: { select: selectData as never }, options: { dialect } });
}

describe("SqlProjection — runtime column selection (object format)", () => {
   describe("column selection", () => {
      test("single column with true (same-name alias)", () => {
         const { text, values } = buildWithSelect({ accountId: true });
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
             /* <query_3> */
             /* </query_3> */
             /* </query_0> */"
         `);
         expect(values).toMatchInlineSnapshot(`[]`);
      });

      test("multiple columns with true", () => {
         const { text, values } = buildWithSelect({ accountId: true, email: true, status: true });
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
             /* <query_3> */
             /* </query_3> */
             /* </query_0> */"
         `);
         expect(values).toMatchInlineSnapshot(`[]`);
      });

      test("column rename (string value)", () => {
         const { text, values } = buildWithSelect({ id: "accountId", mail: "email" });
         expect(text).toMatchInlineSnapshot(`
           "/* <query_0> */
           SELECT
             "a_1"."account_id" AS "id",
             "a_1"."email" AS "mail"
           FROM
             "main"."account" AS "a_1"
             /* <query_1> */
             /* </query_1> */
             /* <query_2> */
             /* </query_2> */
             /* <query_3> */
             /* </query_3> */
             /* </query_0> */"
         `);
         expect(values).toMatchInlineSnapshot(`[]`);
      });
   });

   describe("aggregate functions", () => {
      test("count(*)", () => {
         const { text, values } = buildWithSelect({ status: true, total: { fn: "count", col: "*" } });
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
         expect(values).toMatchInlineSnapshot(`[]`);
      });

      test("sum with keyof column", () => {
         const { text, values } = buildWithSelect({ status: true, totalCreated: { fn: "sum", col: "createdAt" } });
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
             /* </query_3> */
             /* </query_0> */"
         `);
         expect(values).toMatchInlineSnapshot(`[]`);
      });

      test("min and max", () => {
         const { text, values } = buildWithSelect({
            status: true,
            earliest: { fn: "min", col: "createdAt" },
            latest: { fn: "max", col: "createdAt" },
         });
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
             /* <query_3> */
             /* </query_3> */
             /* </query_0> */"
         `);
         expect(values).toMatchInlineSnapshot(`[]`);
      });
   });

   describe("transform functions", () => {
      test("dateTrunc — sqlite", () => {
         const { text } = buildWithSelect({ period: { fn: "dateTrunc", col: "createdAt", args: "month" } }, "sqlite");
         expect(text).toMatchInlineSnapshot(`
           "/* <query_0> */
           SELECT
             strftime('%Y-%m-01', "a_1"."created_at") AS "period"
           FROM
             "main"."account" AS "a_1"
             /* <query_1> */
             /* </query_1> */
             /* <query_2> */
             /* </query_2> */
             /* <query_3> */
             /* </query_3> */
             /* </query_0> */"
         `);
      });

      test("dateTrunc — postgresql", () => {
         const { text } = buildWithSelect({ period: { fn: "dateTrunc", col: "createdAt", args: "month" } }, "postgresql");
         expect(text).toMatchInlineSnapshot(`
           "/* <query_0> */
           SELECT
             date_trunc('month', "a_1"."created_at") AS "period"
           FROM
             "main"."account" AS "a_1"
             /* <query_1> */
             /* </query_1> */
             /* <query_2> */
             /* </query_2> */
             /* <query_3> */
             /* </query_3> */
             /* </query_0> */"
         `);
      });

      test("dateTrunc — transactsql (MSSQL)", () => {
         const { text } = buildWithSelect({ period: { fn: "dateTrunc", col: "createdAt", args: "month" } }, "transactsql");
         expect(text).toMatchInlineSnapshot(`
           "/* <query_0> */
           SELECT
             DATETRUNC (month, "a_1"."created_at") AS "period"
           FROM
             "main"."account" AS "a_1"
             /* <query_1> */
             /* </query_1> */
             /* <query_2> */
             /* </query_2> */
             /* <query_3> */
             /* </query_3> */
             /* </query_0> */"
         `);
      });

      test("round with precision", () => {
         const { text } = buildWithSelect({ rounded: { fn: "round", col: "createdAt", args: [2] } }, "sqlite");
         expect(text).toMatchInlineSnapshot(`
           "/* <query_0> */
           SELECT
             round("a_1"."created_at", 2) AS "rounded"
           FROM
             "main"."account" AS "a_1"
             /* <query_1> */
             /* </query_1> */
             /* <query_2> */
             /* </query_2> */
             /* <query_3> */
             /* </query_3> */
             /* </query_0> */"
         `);
      });

      test("abs", () => {
         const { text } = buildWithSelect({ absolute: { fn: "abs", col: "createdAt" } }, "sqlite");
         expect(text).toMatchInlineSnapshot(`
           "/* <query_0> */
           SELECT
             abs("a_1"."created_at") AS "absolute"
           FROM
             "main"."account" AS "a_1"
             /* <query_1> */
             /* </query_1> */
             /* <query_2> */
             /* </query_2> */
             /* <query_3> */
             /* </query_3> */
             /* </query_0> */"
         `);
      });
   });
   describe("dateTrunc — all granularities", () => {
      test("year — all dialects", () => {
         const { text: sqlite } = buildWithSelect({ p: { fn: "dateTrunc", col: "createdAt", args: "year" } }, "sqlite");
         expect(sqlite).toMatchInlineSnapshot(`
           "/* <query_0> */
           SELECT
             strftime('%Y-01-01', "a_1"."created_at") AS "p"
           FROM
             "main"."account" AS "a_1"
             /* <query_1> */
             /* </query_1> */
             /* <query_2> */
             /* </query_2> */
             /* <query_3> */
             /* </query_3> */
             /* </query_0> */"
         `);
         const { text: pg } = buildWithSelect({ p: { fn: "dateTrunc", col: "createdAt", args: "year" } }, "postgresql");
         expect(pg).toMatchInlineSnapshot(`
           "/* <query_0> */
           SELECT
             date_trunc('year', "a_1"."created_at") AS "p"
           FROM
             "main"."account" AS "a_1"
             /* <query_1> */
             /* </query_1> */
             /* <query_2> */
             /* </query_2> */
             /* <query_3> */
             /* </query_3> */
             /* </query_0> */"
         `);
         const { text: mssql } = buildWithSelect({ p: { fn: "dateTrunc", col: "createdAt", args: "year" } }, "transactsql");
         expect(mssql).toMatchInlineSnapshot(`
           "/* <query_0> */
           SELECT
             DATETRUNC (year, "a_1"."created_at") AS "p"
           FROM
             "main"."account" AS "a_1"
             /* <query_1> */
             /* </query_1> */
             /* <query_2> */
             /* </query_2> */
             /* <query_3> */
             /* </query_3> */
             /* </query_0> */"
         `);
      });

      test("day — all dialects", () => {
         const { text: sqlite } = buildWithSelect({ p: { fn: "dateTrunc", col: "createdAt", args: "day" } }, "sqlite");
         expect(sqlite).toMatchInlineSnapshot(`
           "/* <query_0> */
           SELECT
             strftime('%Y-%m-%d', "a_1"."created_at") AS "p"
           FROM
             "main"."account" AS "a_1"
             /* <query_1> */
             /* </query_1> */
             /* <query_2> */
             /* </query_2> */
             /* <query_3> */
             /* </query_3> */
             /* </query_0> */"
         `);
         const { text: pg } = buildWithSelect({ p: { fn: "dateTrunc", col: "createdAt", args: "day" } }, "postgresql");
         expect(pg).toMatchInlineSnapshot(`
           "/* <query_0> */
           SELECT
             date_trunc('day', "a_1"."created_at") AS "p"
           FROM
             "main"."account" AS "a_1"
             /* <query_1> */
             /* </query_1> */
             /* <query_2> */
             /* </query_2> */
             /* <query_3> */
             /* </query_3> */
             /* </query_0> */"
         `);
         const { text: mssql } = buildWithSelect({ p: { fn: "dateTrunc", col: "createdAt", args: "day" } }, "transactsql");
         expect(mssql).toMatchInlineSnapshot(`
           "/* <query_0> */
           SELECT
             DATETRUNC (day, "a_1"."created_at") AS "p"
           FROM
             "main"."account" AS "a_1"
             /* <query_1> */
             /* </query_1> */
             /* <query_2> */
             /* </query_2> */
             /* <query_3> */
             /* </query_3> */
             /* </query_0> */"
         `);
      });

      test("hour — all dialects", () => {
         const { text: sqlite } = buildWithSelect({ p: { fn: "dateTrunc", col: "createdAt", args: "hour" } }, "sqlite");
         expect(sqlite).toMatchInlineSnapshot(`
           "/* <query_0> */
           SELECT
             strftime('%Y-%m-%d %H:00:00', "a_1"."created_at") AS "p"
           FROM
             "main"."account" AS "a_1"
             /* <query_1> */
             /* </query_1> */
             /* <query_2> */
             /* </query_2> */
             /* <query_3> */
             /* </query_3> */
             /* </query_0> */"
         `);
         const { text: pg } = buildWithSelect({ p: { fn: "dateTrunc", col: "createdAt", args: "hour" } }, "postgresql");
         expect(pg).toMatchInlineSnapshot(`
           "/* <query_0> */
           SELECT
             date_trunc('hour', "a_1"."created_at") AS "p"
           FROM
             "main"."account" AS "a_1"
             /* <query_1> */
             /* </query_1> */
             /* <query_2> */
             /* </query_2> */
             /* <query_3> */
             /* </query_3> */
             /* </query_0> */"
         `);
         const { text: mssql } = buildWithSelect({ p: { fn: "dateTrunc", col: "createdAt", args: "hour" } }, "transactsql");
         expect(mssql).toMatchInlineSnapshot(`
           "/* <query_0> */
           SELECT
             DATETRUNC (hour, "a_1"."created_at") AS "p"
           FROM
             "main"."account" AS "a_1"
             /* <query_1> */
             /* </query_1> */
             /* <query_2> */
             /* </query_2> */
             /* <query_3> */
             /* </query_3> */
             /* </query_0> */"
         `);
      });

      test("invalid granularity for sqlite throws", () => {
         expect(() => buildWithSelect({ p: { fn: "dateTrunc", col: "createdAt", args: "quarter" } }, "sqlite")).toThrow("Invalid dateTrunc granularity");
      });
   });

   describe("coalesce", () => {
      test("string default", () => {
         const { text } = buildWithSelect({ notes: { fn: "coalesce", col: "notes", args: "N/A" } }, "sqlite");
         expect(text).toMatchInlineSnapshot(`
           "/* <query_0> */
           SELECT
             coalesce("a_1"."notes", ?) AS "notes"
           FROM
             "main"."account" AS "a_1"
             /* <query_1> */
             /* </query_1> */
             /* <query_2> */
             /* </query_2> */
             /* <query_3> */
             /* </query_3> */
             /* </query_0> */"
         `);
      });

      test("numeric default", () => {
         const { text } = buildWithSelect({ notes: { fn: "coalesce", col: "notes", args: 0 } }, "sqlite");
         expect(text).toMatchInlineSnapshot(`
           "/* <query_0> */
           SELECT
             coalesce("a_1"."notes", ?) AS "notes"
           FROM
             "main"."account" AS "a_1"
             /* <query_1> */
             /* </query_1> */
             /* <query_2> */
             /* </query_2> */
             /* <query_3> */
             /* </query_3> */
             /* </query_0> */"
         `);
      });

      test("multiple fallbacks (array args)", () => {
         const { text } = buildWithSelect({ notes: { fn: "coalesce", col: "notes", args: ["unknown", "N/A"] } }, "sqlite");
         expect(text).toMatchInlineSnapshot(`
           "/* <query_0> */
           SELECT
             coalesce("a_1"."notes", ?, ?) AS "notes"
           FROM
             "main"."account" AS "a_1"
             /* <query_1> */
             /* </query_1> */
             /* <query_2> */
             /* </query_2> */
             /* <query_3> */
             /* </query_3> */
             /* </query_0> */"
         `);
      });
   });

   describe("concat", () => {
      test("postgresql/sqlite uses || operator", () => {
         const { text } = buildWithSelect({ fullName: { fn: "concat", col: "firstName", args: [" ", "lastName"] } }, "sqlite");
         expect(text).toMatchInlineSnapshot(`
           "/* <query_0> */
           SELECT
             "a_1"."first_name" || ? || ? AS "fullName"
           FROM
             "main"."account" AS "a_1"
             /* <query_1> */
             /* </query_1> */
             /* <query_2> */
             /* </query_2> */
             /* <query_3> */
             /* </query_3> */
             /* </query_0> */"
         `);
      });

      test("mssql uses CONCAT function", () => {
         const { text } = buildWithSelect({ fullName: { fn: "concat", col: "firstName", args: [" ", "lastName"] } }, "transactsql");
         expect(text).toMatchInlineSnapshot(`
           "/* <query_0> */
           SELECT
             CONCAT("a_1"."first_name", @param_0, @param_1) AS "fullName"
           FROM
             "main"."account" AS "a_1"
             /* <query_1> */
             /* </query_1> */
             /* <query_2> */
             /* </query_2> */
             /* <query_3> */
             /* </query_3> */
             /* </query_0> */"
         `);
      });
   });

   describe("round", () => {
      test("without precision", () => {
         const { text } = buildWithSelect({ rounded: { fn: "round", col: "createdAt" } }, "sqlite");
         expect(text).toMatchInlineSnapshot(`
           "/* <query_0> */
           SELECT
             round("a_1"."created_at") AS "rounded"
           FROM
             "main"."account" AS "a_1"
             /* <query_1> */
             /* </query_1> */
             /* <query_2> */
             /* </query_2> */
             /* <query_3> */
             /* </query_3> */
             /* </query_0> */"
         `);
      });
   });

   describe("transforms in GROUP BY", () => {
      test("transform included in GROUP BY when mixed with aggregate", () => {
         const { text } = buildWithSelect({
            period: { fn: "dateTrunc", col: "createdAt", args: "month" },
            total: { fn: "count", col: "*" },
         }, "postgresql");
         expect(text).toMatchInlineSnapshot(`
           "/* <query_0> */
           SELECT
             date_trunc('month', "a_1"."created_at") AS "period",
             count(*) AS "total"
           FROM
             "main"."account" AS "a_1"
             /* <query_1> */
             /* </query_1> */
             /* <query_2> */
           GROUP BY
             date_trunc('month', "a_1"."created_at") /* </query_2> */
             /* <query_3> */
             /* </query_3> */
             /* </query_0> */"
         `);
      });
   });


   describe("auto GROUP BY", () => {
      test("GROUP BY emitted when aggregates present", () => {
         const { text } = buildWithSelect({ status: true, total: { fn: "count", col: "*" } });
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

      test("no GROUP BY when no aggregates", () => {
         const { text } = buildWithSelect({ accountId: true, email: true });
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
             /* <query_3> */
             /* </query_3> */
             /* </query_0> */"
         `);
      });

      test("transforms included in GROUP BY", () => {
         const { text } = buildWithSelect({
            period: { fn: "dateTrunc", col: "createdAt", args: "month" },
            total: { fn: "count", col: "*" },
         }, "sqlite");
         expect(text).toMatchInlineSnapshot(`
           "/* <query_0> */
           SELECT
             strftime('%Y-%m-01', "a_1"."created_at") AS "period",
             count(*) AS "total"
           FROM
             "main"."account" AS "a_1"
             /* <query_1> */
             /* </query_1> */
             /* <query_2> */
           GROUP BY
             strftime('%Y-%m-01', "a_1"."created_at") /* </query_2> */
             /* <query_3> */
             /* </query_3> */
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
             /* <query_3> */
             /* </query_3> */
             /* </query_0> */"
         `);
      });

      test("emits all columns when select is empty object", () => {
         const { text } = buildWithSelect({});
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
             /* <query_3> */
             /* </query_3> */
             /* </query_0> */"
         `);
      });
   });

   describe("error handling", () => {
      test("throws on unknown column name", () => {
         expect(() => buildWithSelect({ bad: "badColumn" })).toThrow("Column not found: badColumn");
      });

      test("throws on invalid function", () => {
         expect(() => buildWithSelect({ x: { fn: "badFn", col: "*" } })).toThrow("Invalid function: badFn");
      });

      test("throws on invalid entry type", () => {
         expect(() => buildWithSelect({ x: 123 })).toThrow("Invalid select entry");
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
         query.getSql({ params: { select: { total: { fn: "sum", col: 123 } } } }),
      ).toThrow("Invalid column reference in aggregate");
   });
});

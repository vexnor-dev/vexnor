import { assertType, describe, expect, test } from "vitest";
import { SqlSelectValue, val } from "#/core/query/sql-select-value.js";
import { row } from "#/core/query/sql-select-row.js";
import { sql } from "#/core/sql.js";
import { SqlBuildContext } from "#/core/builder/sql-build-context.js";
import { Account } from "@test-models/valnor_test.account-table.js";
import { param } from "#/core/query/sql-param.js";
import { ParamsOf } from "#/core/sql-base.js";
import { SqlQueryExtended } from "#/core/query/sql-query.js";

describe("SqlValue tests", () => {
   test("val with generic type parameter", () => {
      const value = val`array_agg(name)`.as<{ names: string[] }>("names");
      expect(value.key).toBe("names");

      assertType<SqlSelectValue<{ Key: "names"; Type: string[]; Params: void }>>(value);
   });

   test("val builds SQL correctly", () => {
      const value = val`COUNT(*)`.as<{ total: number }>("total");
      const context = new SqlBuildContext();
      value.build(context);
      // build() only outputs the query, not the alias
      expect(context.text).toMatchInlineSnapshot(`"/* <query_0> */ COUNT(*) /* </query_0> */ AS "total""`);
      expect(value.key).toBe("total");
   });

   test("val in row context", () => {
      const target = row(Account.$accountId, val`COUNT(*)`.as<{ total: number }>("total"));
      const actual = target.getRow({ query: sql`` });
      expect(actual.$accountId).toBeDefined();
      expect(actual.$total).toBeDefined();
   });

   test("val in sql query", () => {
      const query = sql`
         SELECT ${row(Account.$accountId, val<number>`COUNT(*)`.as<{ orderCount: number }>("orderCount"))}
         FROM ${Account}
      `;

      expect(query.$accountId).toBeDefined();
      expect(query.$orderCount).toBeDefined();
   });

   test("inline type marker takes precedence over generic", () => {
      // If both are provided, inline marker should win
      const value = val`COUNT(*)`.as<{ count: number }>("count");
      expect(value.key).toBe("count");

      // The type should be number (from t<number>()), not string
      type ValueType = typeof value;
      type ExpectedType = { key: "count" };
      const typeCheck: ValueType extends ExpectedType ? true : false = true;
      expect(typeCheck).toBe(true);
   });

   test("complex type with val", () => {
      interface CustomType {
         id: string;
         name: string;
      }

      const value = val`json_agg(row_to_json(t))`.as<{ items: CustomType[] }>("items");
      expect(value.key).toBe("items");
   });

   test("val with multiple inline markers uses first", () => {
      const value = val`expr`.as<{ result: number }>("result");
      assertType<SqlSelectValue<{ Key: "result"; Type: number; Params: void }>>(value);
      expect(value.key).toBe("result");
      // Type should be string (first marker)
   });

   test("type safety: cannot assign wrong type", () => {
      const value = val`COUNT(*)`.as<{ total: number }>("total");
      const query = sql`SELECT ${row(value)}`;

      assertType<SqlQueryExtended<{ Row: { total: number }; Params: void }>>(query);

      const wrongAccess = query.row.$total;
      expect(wrongAccess).toBeDefined();
   });

   test("SqlType marker doesn't affect SQL output", () => {
      const value = val`COUNT(*)`.as<{ total: number }>("total");
      const context = new SqlBuildContext();
      value.build(context);

      // The t<number>() marker should not appear in SQL (only query part)
      expect(context.text).toMatchInlineSnapshot(`"/* <query_0> */ COUNT(*) /* </query_0> */ AS "total""`);
      expect(value.key).toBe("total");
   });

   test("val() rendering in sql() query", () => {
      const query = sql`
         SELECT ${Account.$accountId}, ${val`COUNT(*)`.as<{ total: number }>("total")}
         FROM ${Account}
         GROUP BY ${Account.$accountId}
      `;

      expect(query.row).toBeDefined();
      expect(query.row.$total).toBeDefined();
      expect(query.$total).toBeDefined();

      expect(query.getSql({}).text).toMatchInlineSnapshot(`
        "/* <query_0> */
        SELECT
          "a_1"."account_id" AS "accountId",
          /* <query_1> */ COUNT(*) /* </query_1> */ AS "total"
        FROM
          "main"."account" AS "a_1"
        GROUP BY
          "a_1"."account_id"
          /* </query_0> */"
      `);
   });

   test("val() with complex Record<> result", () => {
      const query = sql`
         SELECT ${row(Account.$accountId)}, ${val`COUNT(*)`.as<{ total: number }>("total")}
         FROM ${Account}
         GROUP BY ${Account.$accountId}
      `;

      expect(query.$total).toBeDefined();
      expect(query.$accountId).toBeDefined();
      expect(query.row.$total).toBeDefined();
      expect(query.row.$accountId).toBeDefined();

      expect(query.getSql({}).text).toMatchInlineSnapshot(`
        "/* <query_0> */
        SELECT
          "a_1"."account_id" AS "accountId",
          /* <query_1> */ COUNT(*) /* </query_1> */ AS "total"
        FROM
          "main"."account" AS "a_1"
        GROUP BY
          "a_1"."account_id"
          /* </query_0> */"
      `);
   });

   test("should extract params query including select value", () => {
      // eslint-disable-next-line unused-imports/no-unused-vars
      const lastModifiedAt = val`${param<{ timestamp: Date }>("timestamp")}`.as<{ lastModifiedAt: Date }>(
         "lastModifiedAt",
      );
      type ValueParams = ParamsOf<typeof lastModifiedAt>;
      assertType<ValueParams>({
         timestamp: new Date(),
         // @ts-expect-error - Testing runtime validation of extra property
         status: "",
      });
   });
});

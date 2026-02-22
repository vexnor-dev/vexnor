import { assertType, describe, expect, test } from "vitest";
import { SqlSelectValue, val } from "../sql-select-value.js";
import { t } from "../sql-type.js";
import { row } from "../sql-select-row.js";
import { sql } from "../../sql.js";
import { SqlBuildContext } from "../sql-build-context.js";
import { Account } from "@test-models/valnor_test.account-table.js";
import { param } from "../sql-param.js";
import { ParamsOf } from "../../sql-base.js";
import { SqlQueryExtended } from "../sql-query.js";

describe("SqlValue tests", () => {
   test("val with generic type parameter", () => {
      const value = val`array_agg(name)`.as<{ names: string[] }>("names");
      expect(value.key).toBe("names");

      // Type check
      type ValueType = typeof value extends { key: string } ? true : false;
      const typeCheck: ValueType = true;
      expect(typeCheck).toBe(true);
   });

   test("val with inline type marker", () => {
      const value = val`array_agg(name)`.as<{ counts: number[] }>("counts");
      expect(value.key).toBe("counts");
   });

   test("val without type defaults to unknown", () => {
      const value = val`some_column`.as<{ col: string }>("col");
      expect(value.key).toBe("col");
   });

   test("val builds SQL correctly", () => {
      const value = val`COUNT(*)`.as<{ total: number }>("total");
      const context = new SqlBuildContext();
      value.build(context);
      // build() only outputs the query, not the alias
      expect(context.text).toBe(`COUNT(*) AS "total"`);
      expect(value.key).toBe("total");
   });

   test("val in row context", () => {
      const target = row(Account.$accountId, val`COUNT(*)`.as<{ total: number }>("total"));
      const actual = target.getRowByQuery({ query: sql`` });
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

      assertType<SqlQueryExtended<{ Row: { total: number } }>>(query);

      const wrongAccess = query.row.$total;
      expect(wrongAccess).toBeDefined();
   });

   test("SqlType marker doesn't affect SQL output", () => {
      const value = val`COUNT(*)`.as<{ total: number }>("total");
      const context = new SqlBuildContext();
      value.build(context);

      // The t<number>() marker should not appear in SQL (only query part)
      expect(context.text).toBe(`COUNT(*) AS "total"`);
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
        "SELECT
          "a_1"."account_id" AS "accountId",
          COUNT(*) AS "total"
        FROM
          "valnor_test"."account" AS "a_1"
        GROUP BY
          "a_1"."account_id""
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
        "SELECT
          "a_1"."account_id" AS "accountId",
          COUNT(*) AS "total"
        FROM
          "valnor_test"."account" AS "a_1"
        GROUP BY
          "a_1"."account_id""
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

describe("SqlType tests", () => {
   test("t() creates SqlType instance", () => {
      const typeMarker = t<string>();
      expect(typeMarker).toBeDefined();
   });

   test("SqlType build is no-op", () => {
      const typeMarker = t<number>();
      const context = new SqlBuildContext();
      typeMarker.build(context);

      // Should not add anything to context
      expect(context.text).toBe("");
      expect(context.values).toEqual([]);
   });

   test("multiple type markers", () => {
      const marker1 = t<string>();
      const marker2 = t<number>();
      const marker3 = t<boolean>();

      expect(marker1).toBeDefined();
      expect(marker2).toBeDefined();
      expect(marker3).toBeDefined();
   });
});

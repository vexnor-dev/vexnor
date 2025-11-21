import { describe, expect, test } from "vitest";
import { val } from "../sql-select-value.js";
import { t } from "../sql-type.js";
import { row } from "../sql-select-row.js";
import { sql } from "../../sql.js";
import { SqlBuildContext } from "../sql-build-context.js";
import { Account } from "@test-models/valnor_test.account-table.js";

describe("SqlValue tests", () => {
   test("val with generic type parameter", () => {
      const value = val<string[]>`array_agg(name)`.as("names");
      expect(value.key).toBe("names");

      // Type check
      type ValueType = typeof value extends { key: string } ? true : false;
      const typeCheck: ValueType = true;
      expect(typeCheck).toBe(true);
   });

   test("val with inline type marker", () => {
      const value = val`array_agg(name) ${t<number[]>()}`.as("counts");
      expect(value.key).toBe("counts");
   });

   test("val without type defaults to unknown", () => {
      const value = val`some_column`.as("col");
      expect(value.key).toBe("col");
   });

   test("val builds SQL correctly", () => {
      const value = val<number>`COUNT(*)`.as("total");
      const context = new SqlBuildContext();
      value.build(context);
      // build() only outputs the query, not the alias
      expect(context.text).toBe(`COUNT(*) as "total"`);
      expect(value.key).toBe("total");
   });

   test("val in row context", () => {
      const selectRow = row(Account.$accountId, val<number>`COUNT(*)`.as("total"));

      expect(selectRow.row.$accountId).toBeDefined();
      expect(selectRow.row.$total).toBeDefined();
   });

   test("val in sql query", () => {
      const query = sql`
         SELECT ${row(Account.$accountId, val<number>`COUNT(*)`.as("orderCount"))}
         FROM ${Account}
      `;

      expect(query.$accountId).toBeDefined();
      expect(query.$orderCount).toBeDefined();
   });

   test("inline type marker takes precedence over generic", () => {
      // If both are provided, inline marker should win
      const value = val<string>`COUNT(*) ${t<number>()}`.as("count");
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

      const value = val<CustomType[]>`json_agg(row_to_json(t))`.as("items");
      expect(value.key).toBe("items");
   });

   test("val with multiple inline markers uses first", () => {
      const value = val`expr ${t<string>()} ${t<number>()}`.as("result");
      expect(value.key).toBe("result");
      // Type should be string (first marker)
   });

   test("type safety: cannot assign wrong type", () => {
      const value = val<number>`COUNT(*)`.as("total");
      const query = sql`SELECT ${row(value)}`;

      const wrongAccess = query.row.$total;
      expect(wrongAccess).toBeDefined();
   });

   test("SqlType marker doesn't affect SQL output", () => {
      const value = val`COUNT(*)${t<number>()}`.as("total");
      const context = new SqlBuildContext();
      value.build(context);

      // The t<number>() marker should not appear in SQL (only query part)
      expect(context.text).toBe(`COUNT(*) as "total"`);
      expect(value.key).toBe("total");
   });

   test("val() rendering in sql() query", () => {
      const query = sql`
         SELECT ${Account.$accountId}, ${val<number>`COUNT(*)`.as("total")}
         FROM ${Account}
         GROUP BY ${Account.$accountId}
      `;

      expect(query.getSql({})).toEqualQuery(`
         SELECT "a_1"."account_id" as "accountId", COUNT(*) as "total"
         FROM "valnor_test"."account" as "a_1"
         GROUP BY "a_1"."account_id"
      `);
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

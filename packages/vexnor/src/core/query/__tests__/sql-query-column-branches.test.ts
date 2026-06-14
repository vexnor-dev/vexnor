import { describe, expect, test } from "vitest";
import { newSqlQueryColumn } from "#/core/query/sql-query-column.js";
import { newSqlTableColumn } from "#/core/schema/sql-table-column.js";
import { SqlBuildContext } from "#/core/builder/sql-build-context.js";
import { sql } from "#/core/sql.js";

const tableInfo = { name: "account", schema: "main" };
const target = newSqlTableColumn({ key: "accountId", columnName: "account_id", tableInfo });
const query = sql``;

function makeCol(key: string, format?: Parameters<typeof newSqlQueryColumn>[0]["format"]) {
   return newSqlQueryColumn({ key, target, query, format });
}

describe("SqlQueryColumn.write() — format branches", () => {
   test("tableName.columnName AS columnAlias — key equals columnName", () => {
      const col = makeCol("accountId", "tableName.columnName AS columnAlias");
      const ctx = new SqlBuildContext({});
      col.build(ctx);
      expect(ctx.text).toMatchInlineSnapshot(`""query_0"."accountId""`);
   });

   test("tableName.columnName AS columnAlias — key differs from columnName", () => {
      const col = makeCol("id", "tableName.columnName AS columnAlias");
      const ctx = new SqlBuildContext({});
      col.build(ctx);
      expect(ctx.text).toMatchInlineSnapshot(`""query_0"."id""`);
   });

   test("tableName.columnName", () => {
      const col = makeCol("accountId", "tableName.columnName");
      const ctx = new SqlBuildContext({});
      col.build(ctx);
      expect(ctx.text).toMatchInlineSnapshot(`""query_0"."accountId""`);
   });

   test("columnName", () => {
      const col = makeCol("accountId", "columnName");
      const ctx = new SqlBuildContext({});
      col.build(ctx);
      expect(ctx.text).toMatchInlineSnapshot(`""accountId""`);
   });

   test("tableName.columnAlias", () => {
      const col = makeCol("id", "tableName.columnAlias");
      const ctx = new SqlBuildContext({});
      col.build(ctx);
      expect(ctx.text).toMatchInlineSnapshot(`""query_0"."id""`);
   });

   test("columnAlias", () => {
      const col = makeCol("id", "columnAlias");
      const ctx = new SqlBuildContext({});
      col.build(ctx);
      expect(ctx.text).toMatchInlineSnapshot(`""id""`);
   });

   test("tableAlias.columnName — key equals columnName", () => {
      const col = makeCol("accountId", "tableAlias.columnName");
      const ctx = new SqlBuildContext({});
      col.build(ctx);
      expect(ctx.text).toMatchInlineSnapshot(`""query_0"."accountId""`);
   });

   test("tableAlias.columnName AS columnAlias — key equals columnName", () => {
      const col = makeCol("accountId", "tableAlias.columnName AS columnAlias");
      const ctx = new SqlBuildContext({});
      col.build(ctx);
      expect(ctx.text).toMatchInlineSnapshot(`""query_0"."accountId""`);
   });

   test("tableAlias.columnName AS columnAlias — key differs from columnName", () => {
      const col = makeCol("id", "tableAlias.columnName AS columnAlias");
      const ctx = new SqlBuildContext({});
      col.build(ctx);
      expect(ctx.text).toMatchInlineSnapshot(`""query_0"."id""`);
   });

   test("(sql) AS columnAlias", () => {
      const innerQuery = sql`SELECT 1`;
      const col = newSqlQueryColumn({
         key: "total",
         target,
         query: innerQuery,
         format: "(sql) AS columnAlias",
      });
      const ctx = new SqlBuildContext({});
      col.build(ctx);
      expect(ctx.text).toMatchInlineSnapshot(`
        "(
          /* <query_0> */
          SELECT
            1 /* </query_0> */
        ) AS "total""
      `);
   });
});

describe("SqlQueryColumn — jsonSchema", () => {
   test("returns empty schema when target has no value for key", () => {
      const col = makeCol("accountId");
      expect(col.jsonSchema).toMatchInlineSnapshot(`{}`);
   });

   test("as() returns a new column with a different key", () => {
      const col = makeCol("accountId");
      const aliased = col.as("id");
      expect(aliased.key).toBe("id");
      expect(aliased.target).toBe(col.target);
   });

   test("render() returns a new column with the given format", () => {
      const col = makeCol("accountId");
      const rendered = col.render("columnName");
      expect(rendered.format).toBe("columnName");
      expect(rendered.key).toBe("accountId");
   });
});

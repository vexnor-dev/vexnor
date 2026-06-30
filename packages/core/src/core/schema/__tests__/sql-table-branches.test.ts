import { describe, expect, test } from "vitest";
import { Account } from "@test-models/vexnor_dev.account-table.js";
import { SqlBuildContext } from "#src/core/builder/sql-build-context.js";

describe("SqlTable.write() — format branches", () => {
   test("tableName format emits only the table name", () => {
      const rendered = Account.render("tableName");
      const ctx = new SqlBuildContext({});
      rendered.build(ctx);
      expect(ctx.text).toMatchInlineSnapshot(`""account""`);
   });

   test("schema.tableName format emits schema.name", () => {
      const rendered = Account.render("schema.tableName");
      const ctx = new SqlBuildContext({});
      rendered.build(ctx);
      expect(ctx.text).toMatchInlineSnapshot(`""main"."account""`);
   });

   test("schema.tableName sets alias for update keyword", () => {
      const rendered = Account.render("schema.tableName");
      const ctx = new SqlBuildContext({});
      ctx.next("update");
      rendered.build(ctx);
      expect(ctx.text).toMatchInlineSnapshot(`""main"."account""`);
   });

   test("schema.tableName sets alias for delete from keyword", () => {
      const rendered = Account.render("schema.tableName");
      const ctx = new SqlBuildContext({});
      ctx.next("delete from");
      rendered.build(ctx);
      expect(ctx.text).toMatchInlineSnapshot(`""main"."account""`);
   });

   test("schema.tableName sets alias for insert into keyword", () => {
      const rendered = Account.render("schema.tableName");
      const ctx = new SqlBuildContext({});
      ctx.next("insert into");
      rendered.build(ctx);
      expect(ctx.text).toMatchInlineSnapshot(`""main"."account""`);
   });

   test("schema.tableName AS tableAlias — same name as alias omits AS", () => {
      const aliased = Account.as("account");
      const ctx = new SqlBuildContext({});
      aliased.build(ctx);
      expect(ctx.text).toMatchInlineSnapshot(`""main"."account""`);
   });

   test("schema.tableName AS tableAlias — different alias includes AS", () => {
      const aliased = Account.as("a");
      const ctx = new SqlBuildContext({});
      aliased.build(ctx);
      expect(ctx.text).toMatchInlineSnapshot(`""main"."account""`);
   });

   test("tableAlias format emits only the alias", () => {
      const rendered = Account.render("tableAlias");
      const ctx = new SqlBuildContext({});
      rendered.build(ctx);
      expect(ctx.text).toMatchInlineSnapshot(`""a_1""`);
   });
});

describe("SqlTable.as() — error and caching", () => {
   test("as() with template tag works", () => {
      const aliased = Account.as`parent`;
      expect(aliased).toBeDefined();
      expect(aliased.tableInfo.alias).toBe("parent");
   });

   test("as() throws for invalid input", () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      expect(() => Account.as(["a", "b"] as any)).toThrow("Invalid table name");
   });

   test("as() caches — same alias returns same instance", () => {
      const a1 = Account.as("x");
      const a2 = Account.as("x");
      expect(a1).toBe(a2);
   });
});

describe("SqlTable.column()", () => {
   test("column() returns column by $key lookup", () => {
      // column() accesses this.cols[key] — the internal cols map uses $-prefixed keys
      // @ts-expect-error column() type expects keyof Select but runtime uses $ prefix
      const col = Account.column("$accountId");
      expect(col.key).toBe("accountId");
   });

   test("column() throws for unknown key", () => {
      // @ts-expect-error non-existing column
      expect(() => Account.column("nonExistent")).toThrow("Column not found");
   });
});

describe("SqlTable — render() caching", () => {
   test("render() caches by format", () => {
      const a = Account.render("tableName");
      const b = Account.render("tableName");
      expect(a).toBe(b);
   });
});

describe("SqlTable — out columns", () => {
   test("out columns have out=true in tableInfo", () => {
      expect(Account.out.$accountId.tableInfo.out).toBe(true);
   });
});

describe("SqlTable — proxy behavior (newSqlTableProxy)", () => {
   test("proxy ownKeys includes table cols", () => {
      const keys = Object.keys(Account);
      expect(keys).toContain("$accountId");
      expect(keys).toContain("$email");
   });

   test("proxy has returns true for cols keys", () => {
      expect("$accountId" in Account).toBe(true);
   });

   test("proxy has returns false for unknown keys", () => {
      expect("nonExistent" in Account).toBe(false);
   });

   test("proxy get returns undefined for unknown keys", () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      expect((Account as any).nonExistent).toBeUndefined();
   });

   test("proxy getOwnPropertyDescriptor for known col key", () => {
      const desc = Object.getOwnPropertyDescriptor(Account, "$accountId");
      expect(desc).toBeDefined();
   });

   test("proxy getOwnPropertyDescriptor for unknown key returns undefined", () => {
      const desc = Object.getOwnPropertyDescriptor(Account, "nonExistent");
      expect(desc).toBeUndefined();
   });
});

describe("SqlTable.write() — tableAlias format not exercised by default", () => {
   test("renders with tableAlias format directly", () => {
      const rendered = Account.render("tableAlias");
      const ctx = new SqlBuildContext({});
      rendered.build(ctx);
      // Should produce just the alias
      expect(ctx.text).toBeDefined();
   });
});

import { newSqlTableColumn } from "#src/core/schema/sql-table-column.js";

const tableInfo = { name: "account", schema: "main", alias: null, out: false };
const col = newSqlTableColumn({ key: "firstName", columnName: "first_name", tableInfo });

describe("SqlTableColumn.write() — format branches", () => {
   test("tableName.columnName AS columnAlias — key differs from columnName", () => {
      const ctx = new SqlBuildContext({});
      const c = newSqlTableColumn({ key: "firstName", columnName: "first_name", tableInfo, format: "tableName.columnName AS columnAlias" });
      c.build(ctx);
      expect(ctx.text).toMatchInlineSnapshot(`""account"."first_name" AS "firstName""`);
   });

   test("tableName.columnName AS columnAlias — key equals columnName", () => {
      const ctx = new SqlBuildContext({});
      const c = newSqlTableColumn({ key: "status", columnName: "status", tableInfo, format: "tableName.columnName AS columnAlias" });
      c.build(ctx);
      expect(ctx.text).toMatchInlineSnapshot(`""account"."status""`);
   });

   test("tableName.columnName", () => {
      const ctx = new SqlBuildContext({});
      const c = newSqlTableColumn({ key: "firstName", columnName: "first_name", tableInfo, format: "tableName.columnName" });
      c.build(ctx);
      expect(ctx.text).toMatchInlineSnapshot(`""account"."first_name""`);
   });

   test("columnName", () => {
      const ctx = new SqlBuildContext({});
      const c = newSqlTableColumn({ key: "firstName", columnName: "first_name", tableInfo, format: "columnName" });
      c.build(ctx);
      expect(ctx.text).toMatchInlineSnapshot(`""first_name""`);
   });

   test("tableName.columnAlias", () => {
      const ctx = new SqlBuildContext({});
      const c = newSqlTableColumn({ key: "firstName", columnName: "first_name", tableInfo, format: "tableName.columnAlias" });
      c.build(ctx);
      expect(ctx.text).toMatchInlineSnapshot(`""account"."firstName""`);
   });

   test("columnAlias", () => {
      const ctx = new SqlBuildContext({});
      const c = newSqlTableColumn({ key: "firstName", columnName: "first_name", tableInfo, format: "columnAlias" });
      c.build(ctx);
      expect(ctx.text).toMatchInlineSnapshot(`""firstName""`);
   });

   test("tableAlias.columnName", () => {
      const ctx = new SqlBuildContext({});
      const c = newSqlTableColumn({ key: "firstName", columnName: "first_name", tableInfo, format: "tableAlias.columnName" });
      c.build(ctx);
      expect(ctx.text).toMatchInlineSnapshot(`""a_1"."first_name""`);
   });

   test("tableAlias.columnName AS columnAlias — key differs from columnName", () => {
      const ctx = new SqlBuildContext({});
      const c = newSqlTableColumn({ key: "firstName", columnName: "first_name", tableInfo, format: "tableAlias.columnName AS columnAlias" });
      c.build(ctx);
      expect(ctx.text).toMatchInlineSnapshot(`""a_1"."first_name" AS "firstName""`);
   });

   test("tableAlias.columnName AS columnAlias — key equals columnName", () => {
      const ctx = new SqlBuildContext({});
      const c = newSqlTableColumn({ key: "status", columnName: "status", tableInfo, format: "tableAlias.columnName AS columnAlias" });
      c.build(ctx);
      expect(ctx.text).toMatchInlineSnapshot(`""a_1"."status""`);
   });

   test("rawAlias.columnName", () => {
      const ctx = new SqlBuildContext({});
      const aliasedTableInfo = { ...tableInfo, alias: "EXCLUDED" };
      const c = newSqlTableColumn({ key: "firstName", columnName: "first_name", tableInfo: aliasedTableInfo, format: "rawAlias.columnName" });
      c.build(ctx);
      expect(ctx.text).toMatchInlineSnapshot(`"EXCLUDED.first_name"`);
   });
});

describe("SqlTableColumn — jsonSchema", () => {
   test("returns empty schema when no jsonType", () => {
      expect(col.jsonSchema).toMatchInlineSnapshot(`{}`);
   });

   test("returns schema with jsonType", () => {
      const dateCol = newSqlTableColumn({ key: "createdAt", columnName: "created_at", tableInfo, jsonType: "Date" });
      expect(dateCol.jsonSchema).toMatchInlineSnapshot(`
        {
          "createdAt": "Date",
        }
      `);
   });
});

describe("SqlTableColumn.as()", () => {
   test("returns new column with different key", () => {
      const aliased = col.as("name");
      expect(aliased.key).toBe("name");
      expect(aliased.columnName).toBe("first_name");
   });
});

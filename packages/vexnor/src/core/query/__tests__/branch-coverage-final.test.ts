import { describe, expect, test } from "vitest";
import { sql } from "#src/core/sql.js";
import { row } from "#src/core/query/sql-select-row.js";
import { insert } from "#src/core/operators/sql-insert-x.js";
import { Account } from "@test-models/vexnor_dev.account-table.js";
import { AccountStatusUdt } from "@test-models/vexnor_dev-enums.js";
import { SqlBuildContext } from "#src/core/builder/sql-build-context.js";
import { param } from "#src/core/query/sql-param.js";

describe("SqlBuildContext.text — param token", () => {
   test("text with param token renders ?", () => {
      const context = new SqlBuildContext({ dialect: "sql" });
      context.addStrings("SELECT * FROM t WHERE id = ");
      context.addParam({ name: "id" });
      expect(context.text).toContain("?");
   });
});

describe("SqlBuildContext.scope — default args", () => {
   test("scope without args defaults to inline", () => {
      const query = sql`SELECT 1`;
      const context = new SqlBuildContext({ dialect: "sql" });
      const result = context.scope(query, () => "done");
      expect(result).toBe("done");
   });
});

describe("SqlBuildContext — getAlias auto-generates from table name", () => {
   test("auto-generates abbreviation alias", () => {
      const context = new SqlBuildContext({ dialect: "sql" });
      const alias = context.getAlias({ name: "order_items", schema: "public" });
      expect(typeof alias).toBe("string");
      expect(alias!.length).toBeGreaterThan(0);
   });

   test("subsequent call for same table returns same alias", () => {
      const context = new SqlBuildContext({ dialect: "sql" });
      const alias1 = context.getAlias({ name: "accounts", schema: "public" });
      const alias2 = context.getAlias({ name: "accounts", schema: "public" });
      expect(alias1).toBe(alias2);
   });
});

describe("SqlSelectRow.getRow — first-item branch (row ?? {})", () => {
   test("getRow with single column (triggers initial null row)", () => {
      const query = sql`SELECT ${row(Account.$email)} FROM ${Account}`;
      expect(query.row.$email).toBeDefined();
   });
});

describe("SqlTable write — INSERT INTO/DELETE FROM/UPDATE context sets alias", () => {
   test("INSERT INTO context with schema.tableName", () => {
      const rendered = Account.render("schema.tableName");
      const query = sql`INSERT INTO ${rendered} ${insert(Account, "rows")}`;
      const context = new SqlBuildContext({ dialect: "sql" });
      query.build(context, null, { queryType: "main", params: { rows: [{ accountId: "1", email: "a@b.com", firstName: "A", lastName: "B", status: AccountStatusUdt.CREATED }] } });
      expect(context.tokens.length).toBeGreaterThan(0);
   });

   test("DELETE FROM context with schema.tableName", () => {
      const rendered = Account.render("schema.tableName");
      const query = sql`DELETE FROM ${rendered} WHERE ${Account.$accountId} = ${"1"}`;
      const context = new SqlBuildContext({ dialect: "sql" });
      query.build(context, null, { queryType: "main" });
      expect(context.tokens.length).toBeGreaterThan(0);
   });
});

describe("SqlTable.as with invalid arg", () => {
   test("as() with multi-element template array throws", () => {
      expect(() => Account.as(["a", "b"] as unknown as TemplateStringsArray)).toThrow();
   });
});

describe("SqlQueryColumn — write with (sql) AS columnAlias format", () => {
   test("subquery column rendered as (sql) AS alias", () => {
      const sub = sql`SELECT ${row(Account.$accountId)} FROM ${Account}`;
      const query = sql`SELECT ${row(sub.out.$accountId.render("(sql) AS columnAlias"))} FROM ${Account}`;
      const context = new SqlBuildContext({ dialect: "sql" });
      query.build(context, null, { queryType: "main" });
      const text = context.tokens.filter(t => t.type === "text").map(t => t.value).join("");
      expect(text).toContain(") as");
   });
});

describe("SqlQuery.write — boundary comments disabled globally", () => {
   test("write with boundaryComments: false", () => {
      const query = sql`SELECT ${row(Account.$accountId)} FROM ${Account}`;
      const context = new SqlBuildContext({ dialect: "sql" });
      query.build(context, { boundaryComments: false }, { queryType: "main" });
      const text = context.tokens.filter(t => t.type === "text").map(t => t.value).join("");
      expect(text).not.toContain("/*");
      expect(text).not.toContain("*/");
   });
});

describe("SqlQuery.getSql — param with undefined value uses default", () => {
   test("undefined param with default resolves to default", () => {
      const query = sql`SELECT ${row(Account.$accountId)} FROM ${Account} WHERE ${Account.$status} = ${param<{ status?: string }>("status", { default: "active" })}`;
      const result = query.getSql({ params: { status: undefined }, options: { dialect: "postgresql" } });
      expect(result.values).toMatchInlineSnapshot(`
        [
          "active",
        ]
      `);
   });
});

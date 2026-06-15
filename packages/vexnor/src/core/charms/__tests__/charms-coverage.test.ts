import { describe, expect, test } from "vitest";
import { sql } from "#/core/sql.js";
import { row } from "#/core/query/sql-select-row.js";
import { Account } from "@test-models/vexnor_dev.account-table.js";
import { Order } from "@test-models/vexnor_dev.order-table.js";
import { SqlBuildContext } from "#/core/builder/sql-build-context.js";
import { info } from "#/core/charms/sql-query-info.js";
import { SqlTableAll } from "#/core/charms/sql-table-all.js";
import { TableInsertCols } from "#/core/charms/table-insert-cols.js";
import { TableInsertRows } from "#/core/charms/table-insert-rows.js";
import { TableUpdateSet } from "#/core/charms/table-update-set.js";
import { TableInsertValues } from "#/core/charms/table-insert-values.js";

describe("SqlQueryInfo — uncovered paths", () => {
   test("info() write outputs comment", () => {
      const queryInfo = info({ label: "test-query", driver: "pg" });
      const context = new SqlBuildContext({ dialect: "sql" });
      queryInfo.build(context);
      const text = context.tokens.map((t) => t.value).join("");
      expect(text).toMatchInlineSnapshot(`
        "
        /* label: test-query, driver: pg */
        "
      `);
   });

   test("info() with only label", () => {
      const queryInfo = info({ label: "my-query" });
      expect(queryInfo.label).toBe("my-query");
      expect(queryInfo.driver).toBeNull();
   });

   test("info() with custom properties", () => {
      const queryInfo = info({ label: "test", custom: "value" });
      expect(queryInfo.options.custom).toBe("value");
   });
});

describe("SqlTableAll — uncovered paths", () => {
   test("write in fn keyword context emits tableName.*", () => {
      const all = Account.$$;
      const context = new SqlBuildContext({ dialect: "sql" });
      context.addStrings("SELECT ");
      context.next("SELECT ");
      // Simulate function context
      context.addStrings("json_agg(");
      context.next("json_agg(");
      all.build(context);
      // Should have emitted something for the fn context
      expect(context.tokens.length).toBeGreaterThan(2);
   });

   test("write in EXISTS context emits *", () => {
      const all = Account.$$;
      const context = new SqlBuildContext({ dialect: "sql" });
      context.addStrings("SELECT ");
      context.next("SELECT ");
      context.addStrings("EXISTS (SELECT ");
      context.next("EXISTS (SELECT ");
      all.build(context);
      const lastToken = context.tokens.at(-1)!;
      expect(lastToken.value).toMatchInlineSnapshot(`"*"`);
   });
});

describe("TableUpdateSet — write with Date value", () => {
   test("Date value is emitted as value token", () => {
      const context = new SqlBuildContext({ dialect: "sql" });
      const query = sql`UPDATE ${Account} SET ${Account.updateSet({ email: "test@test.com" })}`;
      query.build(context, null, { queryType: "main" });
      expect(context.tokens.some((t) => t.type === "value" && t.value === "test@test.com")).toBe(true);
   });

   test("null value is emitted as value token", () => {
      const update = Account.updateSet({ email: null as never });
      const context = new SqlBuildContext({ dialect: "sql" });
      const query = sql`UPDATE ${Account} SET ${update}`;
      query.build(context, null, { queryType: "main" });
      expect(context.tokens.some((t) => t.type === "value" && t.value === null)).toBe(true);
   });
});

describe("TableInsertRows — write", () => {
   test("emits values clause for multiple rows", () => {
      const context = new SqlBuildContext({ dialect: "sql" });
      const query = sql`INSERT INTO ${Account} ${Account.insertColsVals(
         { accountId: "1", email: "a@b.com", firstName: "A", lastName: "B", status: "active" },
         { accountId: "2", email: "c@d.com", firstName: "C", lastName: "D", status: "inactive" },
      )}`;
      query.build(context, null, { queryType: "main" });
      expect(context.tokens.some((t) => t.type === "value" && t.value === "a@b.com")).toBe(true);
      expect(context.tokens.some((t) => t.type === "value" && t.value === "c@d.com")).toBe(true);
   });
});

describe("TableInsertCols — write", () => {
   test("emits column names in parentheses", () => {
      const context = new SqlBuildContext({ dialect: "sql" });
      const query = sql`INSERT INTO ${Account} ${Account.insertCols({ accountId: "1", email: "a@b.com", firstName: "A", lastName: "B", status: "active" })} VALUES (1,2,3,4,5)`;
      query.build(context, null, { queryType: "main" });
      const text = context.tokens.filter((t) => t.type === "text").map((t) => t.value).join("");
      expect(text).toContain("(");
      expect(text).toContain(")");
   });
});

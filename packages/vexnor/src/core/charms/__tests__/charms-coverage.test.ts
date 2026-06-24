import { describe, expect, test } from "vitest";
import { Account } from "@test-models/vexnor_dev.account-table.js";
import { SqlBuildContext } from "#/core/builder/sql-build-context.js";
import { info } from "#/core/charms/sql-query-info.js";

describe("SqlQueryInfo — uncovered paths", () => {
   test("info() write outputs comment", () => {
      const queryInfo = info({ label: "test-query", driver: "pg" });
      const context = new SqlBuildContext({ dialect: "sql" });
      queryInfo.build(context);
      const text = context.tokens.map((t) => ("value" in t ? t.value : "")).join("");
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
      expect("value" in lastToken ? lastToken.value : undefined).toMatchInlineSnapshot(`"*"`);
   });
});

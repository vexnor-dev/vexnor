import { describe, expect, test } from "vitest";
import { Sql, nextId, resetIds } from "#src/core/sql-base.js";
import { SqlBuildError } from "#src/core/sql-build-error.js";
import { SqlError } from "#src/core/sql-error.js";
import { SqlRunError } from "#src/core/sql-run-error.js";
import { SqlErrorCode } from "#src/core/sql-error-code.js";
import { SqlBuildContext } from "#src/core/builder/sql-build-context.js";
import { sql } from "#src/core/sql.js";
import { Account } from "@test-models/vexnor_dev.account-table.js";
import { excluded } from "#src/core/schema/sql-excluded.js";
import { getTableId } from "#src/core/schema/sql-table-identity.js";
import { ok, strictEqual } from "#src/lib/assert.js";
import { newSqlTableColumn } from "#src/core/schema/sql-table-column.js";
import { DefaultFormatter } from "#src/core/builder/default-formatter.js";
import { DefaultTokenizer } from "#src/core/builder/default-tokenizer.js";
import { runWithRetry } from "#src/core/query/sql-retry.js";
import { HttpRemoteClient } from "#src/core/query/http-remote-client.js";
import { SqlSelectCharm } from "#src/core/query/sql-charm.js";
import { SqlParam } from "#src/core/query/sql-param.js";
import { isParamValueValid } from "#src/core/query/params/sql-param-validation.js";
import { validateParamValue } from "#src/core/query/params/validate-param-value.js";

describe("sql-base.ts — uncovered", () => {
   test("Sql.toString() returns id", () => {
      const q = sql`SELECT 1`;
      expect(q.toString()).toBeDefined();
      expect(typeof q.toString()).toBe("string");
   });

   test("Sql[Symbol.toStringTag]() returns string", () => {
      const q = sql`SELECT 1`;
      expect(q[Symbol.toStringTag]()).toBe(q.toString());
   });

   test("Sql.build() wraps errors with context", () => {
      class BadSql extends Sql {
         constructor(options: { type: string; id: string; hashId: string }) { super(options); }
         write() { throw new Error("write failed"); }
      }
      const bad = new BadSql({ type: "Bad", id: "x", hashId: "x" });
      const context = new SqlBuildContext({ dialect: "sql" });
      expect(() => bad.build(context)).toThrow("write failed");
   });

   test("nextId increments counter", () => {
      resetIds();
      expect(nextId("TestClass")).toBe(1);
      expect(nextId("TestClass")).toBe(2);
      expect(nextId("OtherClass")).toBe(1);
   });
});

describe("SqlBuildError", () => {
   test("default code is QUERY_BUILD_FAILED", () => {
      const err = new SqlBuildError("test");
      expect(err.code).toBe(SqlErrorCode.QUERY_BUILD_FAILED);
      expect(err.name).toBe("SqlBuildError");
   });

   test("custom code", () => {
      const err = new SqlBuildError("test", { code: SqlErrorCode.PARAM_VALIDATION_FAILED });
      expect(err.code).toBe(SqlErrorCode.PARAM_VALIDATION_FAILED);
   });
});

describe("SqlError", () => {
   test("default code is QUERY_NOT_FOUND", () => {
      const err = new SqlError("test");
      expect(err.code).toBe(SqlErrorCode.QUERY_NOT_FOUND);
      expect(err.name).toBe("SqlError");
   });
});

describe("SqlRunError", () => {
   test("constructor with all options", () => {
      const err = new SqlRunError("failed", { id: "q1", location: "/test.ts" }, {
         code: SqlErrorCode.QUERY_EXECUTION_FAILED,
         retryable: true,
         queryName: "myQuery",
         sql: "SELECT 1",
         params: { id: "1" },
      });
      expect(err.queryId).toBe("q1");
      expect(err.queryLocation).toBe("/test.ts");
      expect(err.retryable).toBe(true);
      expect(err.sql).toBe("SELECT 1");
      expect(err.code).toBe(SqlErrorCode.QUERY_EXECUTION_FAILED);
   });

   test("withOptions returns new error with merged values", () => {
      const err = new SqlRunError("failed", { id: "q1", location: null }, {
         code: SqlErrorCode.QUERY_TIMEOUT,
         retryable: false,
      });
      const err2 = err.withOptions({ retryable: true, queryName: "updated" });
      expect(err2.retryable).toBe(true);
      expect(err2.queryName).toBe("updated");
      expect(err2.code).toBe(SqlErrorCode.QUERY_TIMEOUT);
   });
});

describe("excluded()", () => {
   test("returns columns with EXCLUDED alias", () => {
      const excl = excluded(Account);
      expect(excl.$accountId).toBeDefined();
      expect(excl.$accountId.tableInfo.alias).toBe("EXCLUDED");
   });

   test("caches result for same table", () => {
      const excl1 = excluded(Account);
      const excl2 = excluded(Account);
      expect(excl1).toBe(excl2);
   });
});

describe("getTableId", () => {
   test("uses alias over name", () => {
      expect(getTableId({ schema: "public", name: "accounts", alias: "a" })).toMatchInlineSnapshot(`"public.a"`);
   });

   test("uses name when no alias", () => {
      expect(getTableId({ schema: "public", name: "accounts" })).toMatchInlineSnapshot(`"public.accounts"`);
   });

   test("null schema uses dash", () => {
      expect(getTableId({ name: "accounts" })).toMatchInlineSnapshot(`"-.accounts"`);
   });
});

describe("SqlTableColumn — uncovered formats", () => {
   test("as() creates column with new key", () => {
      const col = newSqlTableColumn({ key: "email", columnName: "email_address", tableInfo: { name: "accounts", schema: "public" }, jsonType: "Date" });
      const aliased = col.as("myEmail");
      expect(aliased.key).toBe("myEmail");
      expect(aliased.columnName).toBe("email_address");
   });

   test("jsonSchema returns type when jsonType set", () => {
      const col = newSqlTableColumn({ key: "createdAt", columnName: "created_at", tableInfo: { name: "t", schema: "s" }, jsonType: "Date" });
      expect(col.jsonSchema).toMatchInlineSnapshot(`
        {
          "createdAt": "Date",
        }
      `);
   });

   test("jsonSchema is empty when no jsonType", () => {
      const col = newSqlTableColumn({ key: "email", columnName: "email", tableInfo: { name: "t", schema: "s" } });
      expect(col.jsonSchema).toMatchInlineSnapshot(`{}`);
   });
});

describe("DefaultFormatter — uncovered", () => {
   test("getTableFormat returns default format", () => {
      const formatter = new DefaultFormatter();
      const ctx = new SqlBuildContext({ dialect: "sql" });
      expect(formatter.getTableFormat(ctx)).toBeDefined();
   });

   test("getColumnFormat returns default format", () => {
      const formatter = new DefaultFormatter();
      const ctx = new SqlBuildContext({ dialect: "sql" });
      expect(formatter.getColumnFormat(ctx)).toBeDefined();
   });
});

describe("DefaultTokenizer — uncovered", () => {
   test("tokenize splits SQL keywords", () => {
      const tokenizer = new DefaultTokenizer();
      const tokens = tokenizer.tokenize("SELECT * FROM accounts WHERE id = 1");
      expect(tokens.length).toBeGreaterThan(0);
   });
});

describe("runWithRetry — uncovered paths", () => {
   test("no retry on success", async () => {
      const result = await runWithRetry(undefined, undefined, () => Promise.resolve("ok"));
      expect(result).toBe("ok");
   });

   test("retry disabled (false)", async () => {
      let attempts = 0;
      await expect(
         runWithRetry(false, undefined, () => {
            attempts++;
            throw new Error("fail");
         }),
      ).rejects.toThrow("fail");
      expect(attempts).toBe(1);
   });

   test("retries on retryable error", async () => {
      let attempts = 0;
      const result = await runWithRetry(
         { maxAttempts: 3, shouldRetry: () => true, delayMs: 0 },
         undefined,
         (attempt) => {
            attempts = attempt;
            if (attempt < 3) throw new Error("transient");
            return Promise.resolve("ok");
         },
      );
      expect(result).toBe("ok");
      expect(attempts).toBe(3);
   });

   test("stops retrying when shouldRetry returns false", async () => {
      let attempts = 0;
      await expect(
         runWithRetry(
            { maxAttempts: 5, shouldRetry: () => false },
            undefined,
            () => {
               attempts++;
               throw new Error("permanent");
            },
         ),
      ).rejects.toThrow("permanent");
      expect(attempts).toBe(1);
   });

   test("delay function is called between retries", async () => {
      let attempts = 0;
      let delayCalled = false;
      await expect(
         runWithRetry(
            { maxAttempts: 2, shouldRetry: () => true, delayMs: () => { delayCalled = true; return 0; } },
            undefined,
            () => {
               attempts++;
               throw new Error("fail");
            },
         ),
      ).rejects.toThrow("fail");
      expect(delayCalled).toBe(true);
      expect(attempts).toBe(2);
   });
});

describe("HttpRemoteClient — uncovered", () => {
   test("constructor creates client", () => {
      const client = new HttpRemoteClient({
         targetUrl: "/api/db",
         headerResolver: async () => ({ Authorization: "Bearer test" }),
      });
      expect(client).toBeDefined();
   });
});

describe("SqlSelectCharm — uncovered", () => {
   test("jsonSchema returns empty object when no schema provided", () => {
      const charm = new SqlSelectCharm({
         key: "test",
         write: () => {},
         params: null as never,
      });
      expect(charm.jsonSchema).toMatchInlineSnapshot(`{}`);
   });

   test("jsonSchema returns provided schema", () => {
      const charm = new SqlSelectCharm({
         key: "test",
         write: () => {},
         params: null as never,
         jsonSchema: { test: "Date" },
      });
      expect(charm.jsonSchema).toMatchInlineSnapshot(`
        {
          "test": "Date",
        }
      `);
   });
});

describe("SqlParam — uncovered paths", () => {
   test("validate throws on invalid value", () => {
      const p = new SqlParam<{ Name: "age"; Type: number }>({ name: "age", validation: { min: 0 } });
      expect(() => p.validate(-1)).toThrow("Invalid param 'age'");
   });

   test("validate does not throw on valid value", () => {
      const p = new SqlParam<{ Name: "age"; Type: number }>({ name: "age", validation: { min: 0 } });
      expect(() => p.validate(5)).not.toThrow();
   });

   test("valueOrDefault returns default for undefined", () => {
      const p = new SqlParam<{ Name: "x"; Type: number }>({ name: "x", validation: { default: 42 } });
      expect(p.valueOrDefault(undefined)).toBe(42);
   });

   test("valueOrDefault returns value if valid", () => {
      const p = new SqlParam<{ Name: "x"; Type: number }>({ name: "x", validation: { min: 0 } });
      expect(p.valueOrDefault(10)).toBe(10);
   });

   test("valueOrDefault falls back to default if invalid", () => {
      const p = new SqlParam<{ Name: "x"; Type: number }>({ name: "x", validation: { min: 0, default: 0 } });
      expect(p.valueOrDefault(-1)).toBe(0);
   });

   test("valueOrDefault throws if invalid and no default", () => {
      const p = new SqlParam<{ Name: "x"; Type: number }>({ name: "x", validation: { min: 0 } });
      expect(() => p.valueOrDefault(-1)).toThrow();
   });

   test("isValid returns true for valid value", () => {
      const p = new SqlParam<{ Name: "x"; Type: number }>({ name: "x", validation: { min: 0 } });
      expect(p.isValid(5)).toBe(true);
   });

   test("isValid returns false for invalid value", () => {
      const p = new SqlParam<{ Name: "x"; Type: number }>({ name: "x", validation: { min: 0 } });
      expect(p.isValid(-1)).toBe(false);
   });

   test("validOrDefault returns value if valid", () => {
      const p = new SqlParam<{ Name: "x"; Type: number }>({ name: "x", validation: { min: 0 } });
      expect(p.validOrDefault(5, 0)).toBe(5);
   });

   test("validOrDefault returns default if invalid", () => {
      const p = new SqlParam<{ Name: "x"; Type: number }>({ name: "x", validation: { min: 0 } });
      expect(p.validOrDefault(-1, 99)).toBe(99);
   });

   test("hasDefault is true when validation has default", () => {
      const p = new SqlParam<{ Name: "x"; Type: number }>({ name: "x", validation: { default: 42 } });
      expect(p.hasDefault).toBe(true);
      expect(p.default).toBe(42);
   });

   test("hasDefault is false when no validation", () => {
      const p = new SqlParam({ name: "x" });
      expect(p.hasDefault).toBe(false);
   });
});

describe("isParamValueValid / validateParamValue — uncovered rules", () => {
   test("values validation", () => {
      expect(isParamValueValid("x", { values: ["x", "y"] })).toBe(true);
      expect(isParamValueValid("z", { values: ["x", "y"] })).toBe(false);
   });

   test("Date range validation", () => {
      const min = new Date("2020-01-01");
      const max = new Date("2025-01-01");
      expect(isParamValueValid<Date>(new Date("2022-06-01"), { min, max })).toBe(true);
      expect(isParamValueValid<Date>(new Date("2019-01-01"), { min })).toBe(false);
      expect(isParamValueValid<Date>(new Date("2026-01-01"), { max })).toBe(false);
   });

   test("null values pass validation", () => {
      expect(validateParamValue<number>(null, { min: 0 })).toMatchInlineSnapshot(`[]`);
   });

   test("null validation returns empty errors", () => {
      expect(validateParamValue("anything", null)).toMatchInlineSnapshot(`[]`);
   });
});

describe("assert — uncovered", () => {
   test("ok throws when condition is false", () => {
      expect(() => ok(false, "must be true")).toThrow("must be true");
   });

   test("ok does not throw when condition is true", () => {
      expect(() => ok(true, "all good")).not.toThrow();
   });

   test("strictEqual throws when values differ", () => {
      expect(() => strictEqual(1, 2, "must match")).toThrow();
   });

   test("strictEqual does not throw when equal", () => {
      expect(() => strictEqual(1, 1, "ok")).not.toThrow();
   });
});

describe("sql.defaults", () => {
   test("sql.defaults is accessible", () => {
      expect(sql.defaults).toBeDefined();
      expect(typeof sql.defaults.boundaryComments).toBe("boolean");
   });
});

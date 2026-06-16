import { describe, expect, test } from "vitest";
import { sql } from "#/core/sql.js";
import { row } from "#/core/query/sql-select-row.js";
import { ctx, SqlParam } from "#/core/query/sql-param.js";
import { Account } from "@test-models/vexnor_dev.account-table.js";
import { SqlBuildContext } from "#/core/builder/sql-build-context.js";
import { val } from "#/core/query/sql-select-value.js";
import { col as colFactory } from "#/core/query/sql-select-column.js";
import { raw, quote } from "#/core/query/sql-raw.js";
import { expand } from "#/core/query/sql-expand.js";
import { input } from "#/core/query/sql-input.js";
import { info } from "#/core/charms/sql-query-info.js";
import { SqlQueryFormatByKeyword } from "#/core/query/sql-query.js";
import { contextValue } from "#/core/query/context-value.js";
import { runWithRetry } from "#/core/query/sql-retry.js";
import { SqlRunError } from "#/core/sql-run-error.js";
import { SqlErrorCode } from "#/core/sql-error-code.js";

describe("SqlQuery.getSql — format edge cases", () => {
   test("getSql with non-primitive value throws", () => {
      const query = sql`SELECT ${[{ complex: true }] as unknown as string}`;
      expect(() => query.getSql({ options: { dialect: "sql", format: false } })).toThrow("non-primitive");
   });
});

describe("SqlQuery — more uncovered methods on proxy", () => {
   test("ownKeys includes row keys", () => {
      const query = sql`SELECT ${row(Account.$accountId, Account.$email)} FROM ${Account}`;
      const keys = Reflect.ownKeys(query);
      expect(keys).toContain("$accountId");
      expect(keys).toContain("$email");
   });

   test("has returns true for Sql property", () => {
      const query = sql`SELECT ${row(Account.$accountId)} FROM ${Account}`;
      expect("rawStrings" in query).toBe(true);
      expect("id" in query).toBe(true);
   });
});

describe("SqlQueryRef write() — out mode", () => {
   test("out ref writes quoted query name", () => {
      const query = sql`SELECT ${row(Account.$accountId)} FROM ${Account}`;
      const context = new SqlBuildContext({ dialect: "sql" });
      // Register query first
      context.addQuery(query);
      context.scope(query, () => {
         query.out.build(context);
      }, { queryType: "main", cte: false });
      const textTokens = context.tokens.filter(t => t.type === "text").map(t => t.value);
      expect(textTokens.some(t => t.includes('"'))).toBe(true);
   });
});

describe("SqlSelectRow — write", () => {
   test("row writes comma-separated columns", () => {
      const r = row(Account.$accountId, Account.$email);
      const query = sql`SELECT ${r} FROM ${Account}`;
      const context = new SqlBuildContext({ dialect: "sql" });
      query.build(context, null, { queryType: "main" });
      const text = context.tokens.filter(t => t.type === "text").map(t => t.value).join("");
      expect(text).toContain(",");
   });
});

describe("SqlSelectAll — write", () => {
   test("$$ in default context writes columns individually", () => {
      const query = sql`SELECT ${row(Account.$$)} FROM ${Account}`;
      const context = new SqlBuildContext({ dialect: "sql" });
      query.build(context, null, { queryType: "main" });
      const text = context.tokens.filter(t => t.type === "text").map(t => t.value).join("");
      expect(text).toContain(",");
   });
});

describe("SqlSelectColumn — write paths", () => {
   test("col without onWrite writes quoted key", () => {
      const column = colFactory<{ status: string }>("status");
      const context = new SqlBuildContext({ dialect: "sql" });
      column.build(context);
      const text = context.tokens.filter(t => t.type === "text").map(t => t.value).join("");
      expect(text).toContain("status");
   });
});

describe("SqlSelectValue — write", () => {
   test("val template literal creates inline select", () => {
      const v = val`count(*)`.as<{ total: number }>("total");
      const query = sql`SELECT ${row(v)} FROM ${Account}`;
      const context = new SqlBuildContext({ dialect: "sql" });
      query.build(context, null, { queryType: "main" });
      const text = context.tokens.filter(t => t.type === "text").map(t => t.value).join("");
      expect(text).toContain("count(*)");
      expect(text).toContain("total");
   });
});

describe("SqlQueryColumn — write formats", () => {
   test("as() changes key", () => {
      const query = sql`SELECT ${row(Account.$accountId)} FROM ${Account}`;
      const col = query.$accountId;
      const aliased = col.as("myId");
      expect(aliased.key).toBe("myId");
   });

   test("render() changes format", () => {
      const query = sql`SELECT ${row(Account.$accountId)} FROM ${Account}`;
      const col = query.$accountId;
      const rendered = col.render("columnName");
      expect(rendered.format).toBe("columnName");
   });

   test("jsonSchema delegates to target", () => {
      const query = sql`SELECT ${row(Account.$accountId)} FROM ${Account}`;
      const col = query.$accountId;
      expect(col.jsonSchema).toBeDefined();
   });
});

describe("SqlExpand — write with and without params", () => {
   test("expand without context params emits expand token", () => {
      const e = expand<{ ids: string[] }>({ ids: null }, ({ ids }) => ids.map(id => raw(id)));
      const context = new SqlBuildContext({ dialect: "sql" });
      e.build(context);
      expect(context.tokens.some(t => t.type === "expand")).toBe(true);
   });

   test("expand with null return from handler", () => {
      const e = expand<{ mode: string }>({ mode: null }, () => null);
      const context = new SqlBuildContext({ dialect: "sql", params: { mode: "test" } });
      e.build(context);
      // expand that returns null produces no additional tokens beyond the expand
   });
});

describe("sql template — with nested array values", () => {
   test("nested array values are written with commas", () => {
      const cols = [Account.$accountId, Account.$email];
      const query = sql`SELECT ${cols} FROM ${Account}`;
      const context = new SqlBuildContext({ dialect: "sql" });
      query.build(context, null, { queryType: "main" });
      const text = context.tokens.filter(t => t.type === "text").map(t => t.value).join("");
      expect(text).toContain(",");
   });
});

describe("SqlInput — write", () => {
   test("input() proxy generates params that can be used in queries", () => {
      const p = input<{ name: string; age: number }>();
      const query = sql`SELECT ${row(Account.$accountId)} FROM ${Account} WHERE ${Account.$firstName} = ${p.$name}`;
      expect(query.params).toBeDefined();
   });
});

describe("SqlParam — write adds param token", () => {
   test("param write adds param token to context", () => {
      const p = new SqlParam({ name: "myParam" });
      const context = new SqlBuildContext({ dialect: "sql" });
      p.build(context);
      expect(context.tokens[0]).toMatchInlineSnapshot(`
        {
          "name": "myParam",
          "type": "param",
        }
      `);
   });
});

describe("runWithRetry — SqlRunError retryable default", () => {
   test("default shouldRetry uses SqlRunError.retryable", async () => {
      let attempts = 0;
      const retryableError = new SqlRunError("transient", { id: "q1", location: null }, {
         code: SqlErrorCode.QUERY_TIMEOUT,
         retryable: true,
      });
      const result = await runWithRetry(
         { maxAttempts: 2 },
         undefined,
         (attempt) => {
            attempts = attempt;
            if (attempt < 2) throw retryableError;
            return Promise.resolve("done");
         },
      );
      expect(result).toBe("done");
      expect(attempts).toBe(2);
   });

   test("non-retryable SqlRunError stops retry", async () => {
      const nonRetryable = new SqlRunError("permanent", { id: "q1", location: null }, {
         code: SqlErrorCode.QUERY_EXECUTION_FAILED,
         retryable: false,
      });
      await expect(
         runWithRetry({ maxAttempts: 3 }, undefined, () => { throw nonRetryable; }),
      ).rejects.toThrow("permanent");
   });

   test("non-SqlRunError stops retry", async () => {
      await expect(
         runWithRetry({ maxAttempts: 3 }, undefined, () => { throw new Error("generic"); }),
      ).rejects.toThrow("generic");
   });
});

describe("quote() raw SQL function", () => {
   test("quote() creates quoted SqlRaw", () => {
      const q = quote("accounts.email");
      const context = new SqlBuildContext({ dialect: "sql" });
      q.build(context);
      const text = context.tokens.filter(t => t.type === "text").map(t => t.value).join("");
      expect(text).toContain('"');
   });
});

describe("SqlQueryFormatByKeyword", () => {
   test("maps known keywords to formats", () => {
      expect(SqlQueryFormatByKeyword["with"]).toBe("with");
      expect(SqlQueryFormatByKeyword["from"]).toBe("from");
      expect(SqlQueryFormatByKeyword["select"]).toBe("select");
      expect(SqlQueryFormatByKeyword["join"]).toBe("join");
      expect(SqlQueryFormatByKeyword["fn"]).toBe("fn");
      expect(SqlQueryFormatByKeyword["default"]).toBe("default");
      expect(SqlQueryFormatByKeyword["recursive"]).toBe("with");
   });
});

describe("SqlQuery initDialects — covers table dialect", () => {
   test("dialects includes table dialect", () => {
      const query = sql`SELECT ${row(Account.$accountId)} FROM ${Account}`;
      expect(query.dialects.has(Account.dialect)).toBe(true);
   });
});

describe("SqlQuery with info", () => {
   test("info is extracted from rawValues", () => {
      const query = sql`${info({ label: "my-query" })} SELECT ${row(Account.$accountId)} FROM ${Account}`;
      expect(query.info).toBeDefined();
      expect(query.info!.label).toBe("my-query");
   });

   test("label uses info.label when available", () => {
      const query = sql`${info({ label: "my-query" })} SELECT ${row(Account.$accountId)} FROM ${Account}`;
      expect(query.label).toBe("my-query");
   });
});

describe("getSql with contextValue", () => {
   test("contextValue param is treated as null", () => {
      const query = sql`SELECT ${row(Account.$accountId)} FROM ${Account} WHERE ${Account.$accountId} = ${ctx<{ userId: string }>("userId")}`;
      const result = query.getSql({ params: { userId: contextValue as unknown as string }, options: { dialect: "postgresql" } });
      expect(result.values).toMatchInlineSnapshot(`
        [
          null,
        ]
      `);
   });
});

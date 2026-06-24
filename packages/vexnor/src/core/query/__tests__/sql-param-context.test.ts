import { describe, expect, test } from "vitest";
import { sql } from "#/core/sql.js";
import { row } from "#/core/query/sql-select-row.js";
import { ctx, param, SqlParam } from "#/core/query/sql-param.js";
import { isContextValue, contextValue } from "#/core/query/context-value.js";
import { Account } from "@test-models/vexnor_dev.account-table.js";
import { type ConnectionResolver, SqlQueryRegistry } from "#/execution/sql-query-registry.js";
import { type SqlExecuteMode } from "#/core/query/sql-query-types.js";
import { MockConnection, MockPlugin } from "#/test/mock-plugin.js";

const plugin = new MockPlugin({ name: "mock" });

function makeDb(rows: unknown[] = [], capturedParams?: { sql: string; values: unknown[] }[]): MockConnection {
   return {
      query: async (sql, values) => {
         capturedParams?.push({ sql, values });
         return { rows };
      },
   } as MockConnection;
}

function executeRegistry<TContext extends Record<string, unknown> = Record<string, unknown>>(
   registry: SqlQueryRegistry<TContext>,
   {
      plugin,
      hash,
      params = {},
      resolver,
      context,
      mode = "read",
      name = null,
      location = "test",
   }: {
      plugin: string;
      hash: string;
      params?: Record<string, unknown>;
      resolver: ConnectionResolver;
      context?: TContext;
      mode?: SqlExecuteMode;
      name?: string | null;
      location?: string | null;
   },
) {
   return registry.execute({ plugin, hash, params, location, mode, name }, resolver, context);
}

// ── tests ─────────────────────────────────────────────────────────────────────

describe("Context values", () => {
   describe("ctx() factory", () => {
      test("returns a SqlParam instance with isContext: true", () => {
         expect(ctx<{ userId: string }>("userId")).toBeInstanceOf(SqlParam);
         expect(ctx<{ userId: string }>("userId").isContext).toBe(true);
      });

      test("param() returns isContext: false", () => {
         expect(param<{ userId: string }>("userId").isContext).toBe(false);
      });

      test("has type SqlRuntime", () => {
         expect(ctx<{ userId: string }>("userId").type).toMatchInlineSnapshot(`"SqlContext"`);
      });

      test("hashId includes name", () => {
         expect(ctx<{ userId: string }>("userId").hashId).toMatchInlineSnapshot(`"SqlContext#(userId)"`);
      });

      test("different names produce different hashIds", () => {
         expect(ctx<{ userId: string }>("userId").hashId).not.toBe(ctx<{ tenantId: string }>("tenantId").hashId);
      });
   });

   describe("query.params collection", () => {
      test("SqlRuntime nodes are collected into query.params alongside SqlParam", () => {
         const q = sql`
            SELECT ${row(Account.$accountId)}
            FROM ${Account}
            WHERE ${Account.$accountId} = ${ctx<{ userId: string }>("userId")}
              AND ${Account.$email} = ${param<{ email: string }>("email")}
         `;
         expect(q.params).toHaveProperty("userId");
         expect(q.params).toHaveProperty("email");
         expect(q.params!["userId"]).toBeInstanceOf(SqlParam);
         expect(q.params!["userId"].isContext).toBe(true);
         expect(q.params!["email"]).toBeInstanceOf(SqlParam);
         expect(q.params!["email"].isContext).toBe(false);
      });
   });

   describe("hash", () => {
      test("query with runtime has a different hash than the same query without it", async () => {
         const withRuntime = sql`
            SELECT ${row(Account.$accountId)} FROM ${Account}
            WHERE ${Account.$accountId} = ${ctx<{ userId: string }>("userId")}
         `;
         const withParam = sql`
            SELECT ${row(Account.$accountId)} FROM ${Account}
            WHERE ${Account.$accountId} = ${param<{ userId: string }>("userId")}
         `;
         expect(await withRuntime.hash).not.toBe(await withParam.hash);
      });

      test("two queries with the same runtime key have the same hash", async () => {
         const q1 = sql`SELECT ${row(Account.$accountId)} FROM ${Account} WHERE ${Account.$accountId} = ${ctx<{ userId: string }>("userId")}`;
         const q2 = sql`SELECT ${row(Account.$accountId)} FROM ${Account} WHERE ${Account.$accountId} = ${ctx<{ userId: string }>("userId")}`;
         expect(await q1.hash).toBe(await q2.hash);
      });

      test("queries with different runtime keys have different hashes", async () => {
         const q1 = sql`SELECT ${row(Account.$accountId)} FROM ${Account} WHERE ${Account.$accountId} = ${ctx<{ userId: string }>("userId")}`;
         const q2 = sql`SELECT ${row(Account.$accountId)} FROM ${Account} WHERE ${Account.$accountId} = ${ctx<{ tenantId: string }>("tenantId")}`;
         expect(await q1.hash).not.toBe(await q2.hash);
      });

      test("query with no runtime params preserves existing hash behaviour", async () => {
         const q1 = sql`SELECT ${row(Account.$accountId)} FROM ${Account} WHERE ${Account.$accountId} = ${param<{ id: string }>("id")}`;
         const q2 = sql`SELECT ${row(Account.$accountId)} FROM ${Account} WHERE ${Account.$accountId} = ${param<{ id: string }>("id")}`;
         expect(await q1.hash).toBe(await q2.hash);
      });
   });

   describe("direct execution", () => {
      test("runtime value passed directly in params is used in query", () => {
         const q = sql`
            SELECT ${row(Account.$accountId)}
            FROM ${Account}
            WHERE ${Account.$accountId} = ${ctx<{ userId: string }>("userId")}
         `;
         const { values } = q.getSql({ params: { userId: "u-123" } });
         expect(values).toMatchInlineSnapshot(`
           [
             "u-123",
           ]
         `);
      });
   });

   describe("SqlParamBase shared validation", () => {
      test("validates runtime value — throws on invalid", () => {
         const r = ctx<{ userId: string }>("userId", { minLength: 3 });
         expect(() => r.valueOrDefault("ab")).toThrow("Invalid param 'userId'");
      });

      test("uses default when value is undefined", () => {
         const r = ctx<{ userId: string }>("userId", { default: "anon" });
         expect(r.valueOrDefault(undefined)).toBe("anon");
      });

      test("uses default when value is invalid and default is declared", () => {
         const r = ctx<{ userId: string }>("userId", { minLength: 3, default: "anon" });
         expect(r.valueOrDefault("ab")).toBe("anon");
      });

      test("SqlRuntime and SqlParam with same name produce different hashIds", () => {
         expect(ctx<{ userId: string }>("userId").hashId).not.toBe(param<{ userId: string }>("userId").hashId);
      });
   });

   describe("subquery propagation", () => {
      test("runtime params in subquery propagate to parent query params", () => {
         const inner = sql`
            SELECT ${row(Account.$accountId)}
            FROM ${Account}
            WHERE ${Account.$accountId} = ${ctx<{ userId: string }>("userId")}
         `;
         const outer = sql`
            SELECT ${row(Account.$accountId)}
            FROM ${Account}
            WHERE ${Account.$accountId} IN (${inner})
               AND ${Account.$email} = ${param<{ email: string }>("email")}
         `;
         expect(outer.params).toHaveProperty("userId");
         expect(outer.params).toHaveProperty("email");
         expect(outer.params!["userId"]).toBeInstanceOf(SqlParam);
         expect(outer.params!["userId"].isContext).toBe(true);
      });
   });

   describe("registry injection", () => {
      test("registry injects runtime value from context into params", async () => {
         const q = sql`
            SELECT ${row(Account.$accountId, Account.$email)}
            FROM ${Account}
            WHERE ${Account.$accountId} = ${ctx<{ userId: string }>("userId")}
         `;

         const registry = new SqlQueryRegistry<{ userId: string }>();
         await registry.register(plugin, { q });

         const captured: { sql: string; values: unknown[] }[] = [];
         const hash = await q.hash;

         await executeRegistry(registry, { plugin: "mock", hash, resolver: async () => makeDb([], captured), context: { userId: "u-abc" } });

         expect(captured[0]!.values).toMatchInlineSnapshot(`
           [
             "u-abc",
           ]
         `);
      });

      test("registry does not inject runtime value into params if key is not a SqlRuntime node", async () => {
         const q = sql`
            SELECT ${row(Account.$accountId)}
            FROM ${Account}
            WHERE ${Account.$email} = ${param<{ email: string }>("email")}
         `;

         const registry = new SqlQueryRegistry<{ userId: string }>();
         await registry.register(plugin, { q });

         const captured: { sql: string; values: unknown[] }[] = [];
         const hash = await q.hash;

         await executeRegistry(registry, { plugin: "mock", hash, params: { email: "a@b.com" }, resolver: async () => makeDb([], captured), context: {
            userId: "u-abc",
         } });

         expect(captured[0]!.values).toMatchInlineSnapshot(`
           [
             "a@b.com",
           ]
         `);
      });

      test("registry injects runtime alongside caller params", async () => {
         const q = sql`
            SELECT ${row(Account.$accountId)}
            FROM ${Account}
            WHERE ${Account.$accountId} = ${ctx<{ userId: string }>("userId")}
              AND ${Account.$email} = ${param<{ email: string }>("email")}
         `;

         const registry = new SqlQueryRegistry<{ userId: string }>();
         await registry.register(plugin, { q });

         const captured: { sql: string; values: unknown[] }[] = [];
         const hash = await q.hash;

         await executeRegistry(
            registry,
            { plugin: "mock", hash, params: { email: "jane@example.com" }, resolver: async () => makeDb([], captured), context: { userId: "u-xyz" } },
         );

         expect(captured[0]!.values).toMatchInlineSnapshot(`
           [
             "u-xyz",
             "jane@example.com",
           ]
         `);
      });

      test("registry runtime injection validates value via SqlParamBase.valueOrDefault", async () => {
         const q = sql`
            SELECT ${row(Account.$accountId)}
            FROM ${Account}
            WHERE ${Account.$accountId} = ${ctx<{ userId: string }>("userId", { minLength: 1 })}
         `;

         const registry = new SqlQueryRegistry<{ userId: string }>();
         await registry.register(plugin, { q });

         const hash = await q.hash;

         await expect(
            executeRegistry(registry, { plugin: "mock", hash, resolver: async () => makeDb([]), context: { userId: "" } }),
         ).rejects.toThrow("Invalid param 'userId'");
      });
   });
});

describe("runtimeValue sentinel", () => {
   test("isContextValue returns true for runtimeValue", () => {
      expect(isContextValue(contextValue)).toBe(true);
   });

   test("isContextValue returns false for other values", () => {
      expect(isContextValue(null)).toBe(false);
      expect(isContextValue(undefined)).toBe(false);
      expect(isContextValue("")).toBe(false);
      expect(isContextValue(0)).toBe(false);
      expect(isContextValue(Symbol("other"))).toBe(false);
   });

   test("runtimeValue is unique — two references are the same instance", () => {
      expect(contextValue).toBe(contextValue);
   });

   test("passing runtimeValue on direct execution produces null in the SQL values", () => {
      const q = sql`
         SELECT ${row(Account.$accountId)}
         FROM ${Account}
         WHERE ${Account.$accountId} = ${ctx<{ userId: string }>("userId")}
      `;
      // runtimeValue satisfies the type but resolves to null at SQL build time
      const { values } = q.getSql({ params: { userId: contextValue as unknown as string } });
      expect(values).toMatchInlineSnapshot(`
        [
          null,
        ]
      `);
   });

   test("runtimeValue params are stripped before remote execute is called", () => {
      const rawParams: Record<string, unknown> = { userId: contextValue, email: "a@b.com" };
      const stripped = Object.fromEntries(Object.entries(rawParams).filter(([, v]) => !isContextValue(v)));

      expect(stripped).toMatchInlineSnapshot(`
        {
          "email": "a@b.com",
        }
      `);
      expect("userId" in stripped).toBe(false);
   });
});

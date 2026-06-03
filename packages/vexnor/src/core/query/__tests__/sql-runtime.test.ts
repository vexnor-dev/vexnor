import { describe, expect, test, vi } from "vitest";
import { sql } from "#/core/sql.js";
import { row } from "#/core/query/sql-select-row.js";
import { param, SqlParam } from "#/core/query/sql-param.js";
import { runtime } from "#/core/query/sql-runtime.js";
import { Account } from "@test-models/vexnor_dev.account-table.js";
import { QueryRegistry } from "#/registry/query-registry.js";
import { SqlQuery } from "#/core/query/sql-query.js";
import { SqlQueryHandler, newSqlQueryHandler } from "#/core/query/sql-query-handler.js";
import { VexnorPlugin } from "#/plugin/vexnor-plugin.js";
import { SqlRunArgs } from "#/core/query/sql-query-types.js";

// ── minimal mock infrastructure ──────────────────────────────────────────────

type MockResult = { rows: unknown[] };
type MockConnection = { query: (sql: string, params: unknown[]) => Promise<MockResult> };

class MockQueryHandler<T extends { Row?: unknown; Params?: unknown }> extends SqlQueryHandler<
   Pick<T, "Row" | "Params"> & { QueryResult: MockResult; Connection: MockConnection; RunResult: MockResult }
> {
   constructor(private readonly q: SqlQuery<Pick<T, "Row" | "Params">>) {
      super(q, { pluginName: "mock" });
   }
   resolveRows(result: MockResult): T["Row"][] {
      return result.rows as T["Row"][];
   }
   deserialize<TResult = MockResult>(result: TResult, isRemoteClient: boolean) {
      return {
         ...result,
         rows: this.deserializeRows((result as MockResult).rows as T["Row"][], isRemoteClient),
      } as TResult;
   }
   async execute<TResult = MockResult>(
      args: SqlRunArgs<{ Connection: MockConnection; Params: T["Params"] }>,
   ): Promise<TResult> {
      const db = await args.db;
      const { text, values } = this.q.getSql(args);
      return (await db.query(text, values)) as TResult;
   }
}

class MockPlugin extends VexnorPlugin<{ Connection: MockConnection; Config: never }> {
   constructor(readonly name: string) {
      super();
   }
   readonly dialect = "sql";
   readonly driver = "mock";
   getColumnType = vi.fn();
   getSchema = vi.fn();
   getLibrary = vi.fn(() => []);
   createConnection = vi.fn();
   newQueryHandler<T extends { Row?: unknown; Params?: unknown; QueryResult: object; Connection: unknown }>(
      query: SqlQuery<Pick<T, "Row" | "Params">>,
   ) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      return newSqlQueryHandler(new MockQueryHandler(query as any) as any) as any;
   }
}

const plugin = new MockPlugin("mock");

function makeDb(rows: unknown[] = [], capturedParams?: { sql: string; values: unknown[] }[]): MockConnection {
   return {
      query: async (sql, values) => {
         capturedParams?.push({ sql, values });
         return { rows };
      },
   };
}

// ── tests ─────────────────────────────────────────────────────────────────────

describe("SqlRuntime", () => {
   describe("runtime() factory", () => {
      test("returns a SqlParam instance with isRuntime: true", () => {
         expect(runtime<{ userId: string }>("userId")).toBeInstanceOf(SqlParam);
         expect(runtime<{ userId: string }>("userId").isRuntime).toBe(true);
      });

      test("param() returns isRuntime: false", () => {
         expect(param<{ userId: string }>("userId").isRuntime).toBe(false);
      });

      test("has type SqlRuntime", () => {
         expect(runtime<{ userId: string }>("userId").type).toMatchInlineSnapshot(`"SqlRuntime"`);
      });

      test("hashId includes name", () => {
         expect(runtime<{ userId: string }>("userId").hashId).toMatchInlineSnapshot(
            `"SqlRuntime#(userId)"`,
         );
      });

      test("different names produce different hashIds", () => {
         expect(runtime<{ userId: string }>("userId").hashId).not.toBe(
            runtime<{ tenantId: string }>("tenantId").hashId,
         );
      });
   });

   describe("query.params collection", () => {
      test("SqlRuntime nodes are collected into query.params alongside SqlParam", () => {
         const q = sql`
            SELECT ${row(Account.$accountId)}
            FROM ${Account}
            WHERE ${Account.$accountId} = ${runtime<{ userId: string }>("userId")}
              AND ${Account.$email} = ${param<{ email: string }>("email")}
         `;
         expect(q.params).toHaveProperty("userId");
         expect(q.params).toHaveProperty("email");
         expect(q.params!["userId"]).toBeInstanceOf(SqlParam);
         expect((q.params!["userId"] as SqlParam<{ Name: "userId"; Type: string }>).isRuntime).toBe(true);
         expect(q.params!["email"]).toBeInstanceOf(SqlParam);
         expect((q.params!["email"] as SqlParam<{ Name: "email"; Type: string }>).isRuntime).toBe(false);
      });
   });

   describe("hash", () => {
      test("query with runtime has a different hash than the same query without it", async () => {
         const withRuntime = sql`
            SELECT ${row(Account.$accountId)} FROM ${Account}
            WHERE ${Account.$accountId} = ${runtime<{ userId: string }>("userId")}
         `;
         const withParam = sql`
            SELECT ${row(Account.$accountId)} FROM ${Account}
            WHERE ${Account.$accountId} = ${param<{ userId: string }>("userId")}
         `;
         expect(await withRuntime.hash).not.toBe(await withParam.hash);
      });

      test("two queries with the same runtime key have the same hash", async () => {
         const q1 = sql`SELECT ${row(Account.$accountId)} FROM ${Account} WHERE ${Account.$accountId} = ${runtime<{ userId: string }>("userId")}`;
         const q2 = sql`SELECT ${row(Account.$accountId)} FROM ${Account} WHERE ${Account.$accountId} = ${runtime<{ userId: string }>("userId")}`;
         expect(await q1.hash).toBe(await q2.hash);
      });

      test("queries with different runtime keys have different hashes", async () => {
         const q1 = sql`SELECT ${row(Account.$accountId)} FROM ${Account} WHERE ${Account.$accountId} = ${runtime<{ userId: string }>("userId")}`;
         const q2 = sql`SELECT ${row(Account.$accountId)} FROM ${Account} WHERE ${Account.$accountId} = ${runtime<{ tenantId: string }>("tenantId")}`;
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
            WHERE ${Account.$accountId} = ${runtime<{ userId: string }>("userId")}
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
         const r = runtime<{ userId: string }>("userId", { minLength: 3 });
         expect(() => r.valueOrDefault("ab")).toThrow("Invalid param 'userId'");
      });

      test("uses default when value is undefined", () => {
         const r = runtime<{ userId: string }>("userId", { default: "anon" });
         expect(r.valueOrDefault(undefined)).toBe("anon");
      });

      test("uses default when value is invalid and default is declared", () => {
         const r = runtime<{ userId: string }>("userId", { minLength: 3, default: "anon" });
         expect(r.valueOrDefault("ab")).toBe("anon");
      });

      test("SqlRuntime and SqlParam with same name produce different hashIds", () => {
         expect(runtime<{ userId: string }>("userId").hashId).not.toBe(
            param<{ userId: string }>("userId").hashId,
         );
      });
   });

   describe("subquery propagation", () => {
      test("runtime params in subquery propagate to parent query params", () => {
         const inner = sql`
            SELECT ${row(Account.$accountId)}
            FROM ${Account}
            WHERE ${Account.$accountId} = ${runtime<{ userId: string }>("userId")}
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
         expect((outer.params!["userId"] as SqlParam<{ Name: "userId"; Type: string }>).isRuntime).toBe(true);
      });
   });

   describe("registry injection", () => {
      test("registry injects runtime value from context into params", async () => {
         const q = sql`
            SELECT ${row(Account.$accountId, Account.$email)}
            FROM ${Account}
            WHERE ${Account.$accountId} = ${runtime<{ userId: string }>("userId")}
         `;

         const registry = new QueryRegistry<{ userId: string }>();
         await registry.register(plugin, { q });

         const captured: { sql: string; values: unknown[] }[] = [];
         const hash = await q.hash;

         await registry.execute("mock", hash, {}, async () => makeDb([], captured), { userId: "u-abc" });

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

         const registry = new QueryRegistry<{ userId: string }>();
         await registry.register(plugin, { q });

         const captured: { sql: string; values: unknown[] }[] = [];
         const hash = await q.hash;

         await registry.execute(
            "mock",
            hash,
            { email: "a@b.com" },
            async () => makeDb([], captured),
            { userId: "u-abc" },
         );

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
            WHERE ${Account.$accountId} = ${runtime<{ userId: string }>("userId")}
              AND ${Account.$email} = ${param<{ email: string }>("email")}
         `;

         const registry = new QueryRegistry<{ userId: string }>();
         await registry.register(plugin, { q });

         const captured: { sql: string; values: unknown[] }[] = [];
         const hash = await q.hash;

         await registry.execute(
            "mock",
            hash,
            { email: "jane@example.com" },
            async () => makeDb([], captured),
            { userId: "u-xyz" },
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
            WHERE ${Account.$accountId} = ${runtime<{ userId: string }>("userId", { minLength: 1 })}
         `;

         const registry = new QueryRegistry<{ userId: string }>();
         await registry.register(plugin, { q });

         const hash = await q.hash;

         await expect(
            registry.execute("mock", hash, {}, async () => makeDb([]), { userId: "" }),
         ).rejects.toThrow("Invalid param 'userId'");
      });
   });
});

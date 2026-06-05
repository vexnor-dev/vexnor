import { describe, expect, test, vi } from "vitest";
import { QueryRegistry, type ConnectionResolver } from "#/registry/query-registry.js";
import { TimeToLiveRateLimiter } from "#/registry/time-to-live-rate-limiter.js";
import { AuditLogPlugin } from "#/registry/audit-log-plugin.js";
import { sql } from "#/core/sql.js";
import { row } from "#/core/query/sql-select-row.js";
import { param } from "#/core/query/sql-param.js";
import { SqlQueryHandler, newSqlQueryHandler } from "#/core/query/sql-query-handler.js";
import { SqlQuery, SqlQueryAny } from "#/core/query/sql-query.js";
import { VexnorPlugin } from "#/plugin/vexnor-plugin.js";
import { SqlRunArgs, type SqlExecuteMode } from "#/core/query/sql-query-types.js";
import { Account } from "@test-models/vexnor_dev.account-table.js";
import { Order } from "@test-models/vexnor_dev.order-table.js";
import { SqlRunError } from "#/core/sql-run-error.js";
import { ok } from "node:assert";
import { AfterArgs } from "#/registry/query-execution-plugin.js";

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

// Two distinct plugins
const pluginA = new MockPlugin("pluginA");
const pluginB = new MockPlugin("pluginB");

// One query per plugin
const findAccounts = sql`
   select ${row(Account.$accountId, Account.$email)}
   from ${Account}
   where ${Account.$email} = ${param<{ email: string }>("email")}
`;

const findOrders = sql`
   select ${row(Order.$orderId, Order.$status)}
   from ${Order}
`;

function makeDb(rows: unknown[] = []): MockConnection {
   return { query: async () => ({ rows }) };
}

function executeRegistry<TResult = MockResult, TRuntime extends Record<string, unknown> = Record<string, unknown>>(
   registry: QueryRegistry<TRuntime>,
   plugin: string,
   hash: string,
   params: Record<string, unknown>,
   resolver: ConnectionResolver,
   context?: TRuntime,
   mode: SqlExecuteMode = "query",
) {
   return registry.execute<TResult>({ plugin, hash, params, location: "test", mode }, resolver, context);
}

// ── tests ────────────────────────────────────────────────────────────────────

describe("QueryRegistry", () => {
   test("register stores queries for two plugins and execute runs each independently", async () => {
      const registry = new QueryRegistry();
      await registry.register(pluginA, { findAccounts });
      await registry.register(pluginB, { findOrders });

      const hashA = await findAccounts.hash;
      const hashB = await findOrders.hash;

      const resultA = await executeRegistry(registry, "pluginA", hashA, { email: "a@b.com" }, async () =>
         makeDb([{ accountId: "1", email: "a@b.com" }]),
      );
      const resultB = await executeRegistry(registry, "pluginB", hashB, {}, async () =>
         makeDb([{ orderId: "o1", status: "pending" }]),
      );

      expect(resultA).toMatchInlineSnapshot(`
        {
          "rows": [
            {
              "accountId": "1",
              "email": "a@b.com",
            },
          ],
        }
      `);
      expect(resultB).toMatchInlineSnapshot(`
        {
          "rows": [
            {
              "orderId": "o1",
              "status": "pending",
            },
          ],
        }
      `);
   });

   test("queries are scoped per plugin — pluginA hash not found under pluginB", async () => {
      const registry = new QueryRegistry();
      await registry.register(pluginA, { findAccounts });
      await registry.register(pluginB, { findOrders });

      const hashA = await findAccounts.hash;

      await expect(
         executeRegistry(registry, "pluginB", hashA, { email: "a@b.com" }, async () => makeDb()),
      ).rejects.toMatchInlineSnapshot(
         `[SqlError: Unknown query hash: 2ab5ce374f9cecb297f54776cc0b291d6437c554703f3c0a5ecf09782bec890c for plugin: pluginB]`,
      );
   });

   test("register is idempotent — re-registering same plugin/query is safe", async () => {
      const registry = new QueryRegistry();
      await registry.register(pluginA, { findAccounts });
      await registry.register(pluginA, { findAccounts }); // second call must not throw
      await registry.register(pluginB, { findOrders });
      await registry.register(pluginB, { findOrders });

      const hashA = await findAccounts.hash;
      const hashB = await findOrders.hash;

      expect(await executeRegistry(registry, "pluginA", hashA, { email: "x@y.com" }, async () => makeDb([])))
         .toMatchInlineSnapshot(`
           {
             "rows": [],
           }
         `);
      expect(await executeRegistry(registry, "pluginB", hashB, {}, async () => makeDb([]))).toMatchInlineSnapshot(`
        {
          "rows": [],
        }
      `);
   });

   test("register with a different plugin instance for the same name keeps the first", async () => {
      const registry = new QueryRegistry();
      await registry.register(pluginA, { findAccounts });

      const pluginA2 = new MockPlugin("pluginA");
      await registry.register(pluginA2, { findAccounts });

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      expect((registry as any).plugins.get("pluginA")).toBe(pluginA);
   });

   test("register with zero queries is a no-op", async () => {
      const registry = new QueryRegistry();
      await registry.register(pluginA, {});
      await registry.register(pluginB, {});

      const hashA = await findAccounts.hash;
      await expect(executeRegistry(registry, "pluginA", hashA, {}, async () => makeDb())).rejects.toMatchInlineSnapshot(
         `[SqlError: Unknown query hash: 2ab5ce374f9cecb297f54776cc0b291d6437c554703f3c0a5ecf09782bec890c for plugin: pluginA]`,
      );
   });

   test("register accepts multiple queries in one call", async () => {
      const q2 = sql`select ${row(Account.$accountId)} from ${Account}`;
      const registry = new QueryRegistry();
      await registry.register(pluginA, { findAccounts, q2 });
      await registry.register(pluginB, { findOrders });

      const h1 = await findAccounts.hash;
      const h2 = await q2.hash;
      const hB = await findOrders.hash;

      expect(h1).not.toBe(h2);

      const r1 = await executeRegistry(registry, "pluginA", h1, { email: "a@b.com" }, async () =>
         makeDb([{ accountId: "1" }]),
      );
      const r2 = await executeRegistry(registry, "pluginA", h2, {}, async () => makeDb([{ accountId: "2" }]));
      const rB = await executeRegistry(registry, "pluginB", hB, {}, async () => makeDb([{ orderId: "o1" }]));

      expect(r1).toMatchInlineSnapshot(`
        {
          "rows": [
            {
              "accountId": "1",
            },
          ],
        }
      `);
      expect(r2).toMatchInlineSnapshot(`
        {
          "rows": [
            {
              "accountId": "2",
            },
          ],
        }
      `);
      expect(rB).toMatchInlineSnapshot(`
        {
          "rows": [
            {
              "orderId": "o1",
            },
          ],
        }
      `);
   });

   test("execute throws for unknown query hash", async () => {
      const registry = new QueryRegistry();
      await registry.register(pluginA, { findAccounts });
      await registry.register(pluginB, { findOrders });

      await expect(
         executeRegistry(registry, "pluginA", "deadbeef", {}, async () => makeDb()),
      ).rejects.toMatchInlineSnapshot(`[SqlError: Unknown query hash: deadbeef for plugin: pluginA]`);

      await expect(
         executeRegistry(registry, "pluginB", "deadbeef", {}, async () => makeDb()),
      ).rejects.toMatchInlineSnapshot(`[SqlError: Unknown query hash: deadbeef for plugin: pluginB]`);
   });

   test("execute throws for unknown plugin name", async () => {
      const registry = new QueryRegistry();

      await expect(
         executeRegistry(registry, "ghost", "deadbeef", {}, async () => makeDb()),
      ).rejects.toMatchInlineSnapshot(`[SqlError: Unknown query hash: deadbeef for plugin: ghost]`);
   });

   test("execute throws assertion error when plugin missing after map entry exists", async () => {
      const registry = new QueryRegistry();
      await registry.register(pluginA, { findAccounts });
      await registry.register(pluginB, { findOrders });

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (registry as any).plugins.delete("pluginA");

      const hash = await findAccounts.hash;
      await expect(
         executeRegistry(registry, "pluginA", hash, { email: "a@b.com" }, async () => makeDb()),
      ).rejects.toMatchInlineSnapshot(`[Error: Unknown plugin: undefined]`);

      // pluginB must still work
      const hashB = await findOrders.hash;
      await expect(executeRegistry(registry, "pluginB", hashB, {}, async () => makeDb([]))).resolves
         .toMatchInlineSnapshot(`
        {
          "rows": [],
        }
      `);
   });

   test("resolver is called with the correct plugin name for each plugin", async () => {
      const registry = new QueryRegistry();
      await registry.register(pluginA, { findAccounts });
      await registry.register(pluginB, { findOrders });

      const resolverA = vi.fn(async () => makeDb([{ accountId: "1", email: "z@z.com" }]));
      const resolverB = vi.fn(async () => makeDb([{ orderId: "o1", status: "done" }]));

      const hashA = await findAccounts.hash;
      const hashB = await findOrders.hash;

      await executeRegistry(registry, "pluginA", hashA, { email: "z@z.com" }, resolverA);
      await executeRegistry(registry, "pluginB", hashB, {}, resolverB);

      expect(resolverA).toHaveBeenCalledOnce();
      expect(resolverA).toHaveBeenCalledWith({
         plugin: "pluginA",
         hash: hashA,
         params: { email: "z@z.com" },
         location: "test",
         mode: "query",
      });
      expect(resolverB).toHaveBeenCalledOnce();
      expect(resolverB).toHaveBeenCalledWith({
         plugin: "pluginB",
         hash: hashB,
         params: {},
         location: "test",
         mode: "query",
      });
   });

   // ── register filtering ────────────────────────────────────────────────────

   test("register stores query name from object key and it appears in after() args", async () => {
      const registry = new QueryRegistry();
      await registry.register(pluginA, { findAccounts });

      const onLog = vi.fn();
      registry.use(new AuditLogPlugin({ onLog }));

      const hash = await findAccounts.hash;
      await executeRegistry(registry, "pluginA", hash, { email: "a@b.com" }, async () => makeDb([]));

      expect(onLog).toHaveBeenCalledWith(
         expect.objectContaining({
            name: "findAccounts",
            query: findAccounts,
            input: {
               hash,
               plugin: "pluginA",
               location: "test",
               params: { email: "a@b.com" },
               mode: "query",
            } satisfies AfterArgs["input"],
         }),
      );
   });

   test("register skips non-SqlQuery values and warns", async () => {
      const registry = new QueryRegistry();
      const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});

      await registry.register(pluginA, {
         findAccounts,
         notAQuery: "some string" as unknown as SqlQueryAny,
         alsoNotAQuery: 42 as unknown as SqlQueryAny,
      });

      expect(registry.getQueries()).toHaveLength(1);
      expect(warnSpy).toHaveBeenCalledTimes(2);
      expect(warnSpy).toHaveBeenCalledWith(
         `[vexnor] QueryRegistry.register: skipping "notAQuery" — not a SqlQuery instance`,
      );
      expect(warnSpy).toHaveBeenCalledWith(
         `[vexnor] QueryRegistry.register: skipping "alsoNotAQuery" — not a SqlQuery instance`,
      );

      warnSpy.mockRestore();
   });

   // ── getAuthorizedQueries / getUnauthorizedQueries ─────────────────────────

   test("getQueries returns all registered queries across all plugins", async () => {
      const registry = new QueryRegistry();
      await registry.register(pluginA, { findAccounts });
      await registry.register(pluginB, { findOrders });

      expect(registry.getQueries()).toHaveLength(2);
   });

   test("getAuthorizedQueries returns only tagged queries", async () => {
      const taggedQuery = findAccounts.authorize("admin");
      const registry = new QueryRegistry();
      await registry.register(pluginA, { taggedQuery });
      await registry.register(pluginB, { findOrders });

      expect(registry.getAuthorizedQueries().map((q) => q.authorization)).toEqual(["admin"]);
   });

   test("getUnauthorizedQueries returns only untagged queries", async () => {
      const taggedQuery = findAccounts.authorize("admin");
      const registry = new QueryRegistry();
      await registry.register(pluginA, { taggedQuery });
      await registry.register(pluginB, { findOrders });

      expect(registry.getUnauthorizedQueries().map((q) => q.authorization)).toEqual([null]);
   });

   test("getAuthorizedQueries returns empty when no queries are tagged", async () => {
      const registry = new QueryRegistry();
      await registry.register(pluginA, { findAccounts });
      await registry.register(pluginB, { findOrders });

      expect(registry.getAuthorizedQueries()).toEqual([]);
   });

   test("getUnauthorizedQueries returns empty when all queries are tagged", async () => {
      const registry = new QueryRegistry();
      await registry.register(pluginA, { findAccounts: findAccounts.authorize("admin") });
      await registry.register(pluginB, { findOrders: findOrders.authorize("admin") });

      expect(registry.getUnauthorizedQueries()).toEqual([]);
   });

   // ── checkAuthorization ──────────────────────────────────────────────────────

   test("checkAuthorization passes when all authorized queries have a hook", async () => {
      const registry = new QueryRegistry();
      await registry.register(pluginA, { findAccounts: findAccounts.authorize("admin") });
      registry.registerAuthorization(() => {});
      expect(() => registry.checkAuthorization()).not.toThrow();
   });

   test("checkAuthorization passes when there are no authorized queries", async () => {
      const registry = new QueryRegistry();
      await registry.register(pluginA, { findAccounts });
      expect(() => registry.checkAuthorization()).not.toThrow();
   });

   test("checkAuthorization throws when authorized queries exist but no hook is registered", async () => {
      const registry = new QueryRegistry();
      await registry.register(pluginA, { findAccounts: findAccounts.authorize("admin") });
      await registry.register(pluginB, { findOrders: findOrders.authorize("admin") });
      expect(() => registry.checkAuthorization()).toThrowErrorMatchingInlineSnapshot(
         `
        [SqlError: 2 queries require authorization but no hook is registered: SqlQuery#1: 
           select  SqlSelectRow#1(SqlTableColumn#1(account.account_id as accountId), SqlTableColumn#3(account.email)) 
           from  SqlTable#1(main.account) 
           where  SqlTableColumn#3(account.email)  =  $email 
        , SqlQuery#2: 
           select  SqlSelectRow#2(SqlTableColumn#10(order.order_id as orderId), SqlTableColumn#11(order.status)) 
           from  SqlTable#2(main.order) 
        ]
      `,
      );
   });

   test("execute wraps errors in SqlRunError with queryName from registered key", async () => {
      const registry = new QueryRegistry();
      await registry.register(pluginA, { findAccounts });

      const hash = await findAccounts.hash;
      const err = await executeRegistry(registry, "pluginA", hash, { email: "x" }, async () => ({
         query: async () => {
            throw new Error("db failure");
         },
      })).catch((e: unknown) => e);

      ok(err instanceof SqlRunError);
      expect(err.queryName).toBe("findAccounts");
   });

   // ── AuditLogPlugin ────────────────────────────────────────────────────────

   test("AuditLogPlugin onLog is called after successful execution", async () => {
      const registry = new QueryRegistry();
      await registry.register(pluginA, { findAccounts });

      const onLog = vi.fn();
      registry.use(new AuditLogPlugin({ onLog }));

      const hash = await findAccounts.hash;
      await executeRegistry(registry, "pluginA", hash, { email: "a@b.com" }, async () => makeDb([]));

      expect(onLog).toHaveBeenCalledOnce();
      expect(onLog).toHaveBeenCalledWith(
         expect.objectContaining({
            query: findAccounts,
            plugin: pluginA,
            params: { email: "a@b.com" },
            error: null,
            durationMs: expect.any(Number),
            context: null,
         }),
      );
   });

   test("AuditLogPlugin onLog is called after failed execution with the error", async () => {
      const registry = new QueryRegistry();
      await registry.register(pluginA, { findAccounts });

      const onLog = vi.fn();
      registry.use(new AuditLogPlugin({ onLog }));

      const hash = await findAccounts.hash;
      await expect(
         executeRegistry(registry, "pluginA", hash, { email: "a@b.com" }, async () => ({
            query: async () => {
               throw new Error("db failure");
            },
         })),
      ).rejects.toThrow();

      expect(onLog).toHaveBeenCalledOnce();
      expect(onLog).toHaveBeenCalledWith(expect.objectContaining({ error: expect.any(Error) }));
   });

   test("multiple AuditLogPlugin instances accumulate and all fire", async () => {
      const registry = new QueryRegistry();
      await registry.register(pluginA, { findAccounts });

      const order: number[] = [];
      registry.use(new AuditLogPlugin({ name: "audit-1", onLog: () => order.push(1) }));
      registry.use(new AuditLogPlugin({ name: "audit-2", onLog: () => order.push(2) }));

      const hash = await findAccounts.hash;
      await executeRegistry(registry, "pluginA", hash, { email: "a@b.com" }, async () => makeDb([]));

      expect(order).toEqual([1, 2]);
   });

   test("AuditLogPlugin after() does not fire when authorization denies execution", async () => {
      const taggedQuery = findAccounts.authorize("admin");
      const registry = new QueryRegistry();
      await registry.register(pluginA, { taggedQuery });
      registry.registerAuthorization(() => {
         throw new Error("denied");
      });

      const onLog = vi.fn();
      registry.use(new AuditLogPlugin({ onLog }));

      const hash = await taggedQuery.hash;
      await expect(
         executeRegistry(registry, "pluginA", hash, { email: "a@b.com" }, async () => makeDb([])),
      ).rejects.toThrow("denied");

      expect(onLog).not.toHaveBeenCalled();
   });

   // ── authorize hook ────────────────────────────────────────────────────────

   test("authorize hook receives the authorization of a tagged query", async () => {
      const taggedQuery = findAccounts.authorize("admin");
      const registry = new QueryRegistry();
      await registry.register(pluginA, { taggedQuery });

      const hook = vi.fn();
      registry.registerAuthorization(hook);

      const hash = await taggedQuery.hash;
      await executeRegistry(registry, "pluginA", hash, { email: "a@b.com" }, async () => makeDb([]));

      expect(hook).toHaveBeenCalledOnce();
      expect(hook).toHaveBeenCalledWith({
         plugin: pluginA,
         query: taggedQuery,
         name: "taggedQuery",
         location: "test",
         params: { email: "a@b.com" },
         context: {},
      });
   });

   test("authorize hook is not called for an untagged query", async () => {
      const registry = new QueryRegistry();
      await registry.register(pluginA, { findAccounts });

      const hook = vi.fn();
      hook.mockReset();
      registry.registerAuthorization(hook);

      const hash = await findAccounts.hash;
      await executeRegistry(registry, "pluginA", hash, { email: "a@b.com" }, async () => makeDb([]));

      expect(hook).not.toHaveBeenCalled();
   });

   test("authorize hook throwing denies execution and resolver is never called", async () => {
      const taggedQuery = findAccounts.authorize("admin");
      const registry = new QueryRegistry();
      await registry.register(pluginA, { taggedQuery });

      registry.registerAuthorization(({ query }) => {
         throw new Error(`Forbidden: ${query.authorization}`);
      });

      const resolver = vi.fn(async () => makeDb([]));
      const hash = await taggedQuery.hash;

      await expect(
         executeRegistry(registry, "pluginA", hash, { email: "a@b.com" }, resolver),
      ).rejects.toMatchInlineSnapshot(
         `[SqlRunError: Authorization denied for query "taggedQuery". (Error: Forbidden: admin)]`,
      );
      expect(resolver).not.toHaveBeenCalled();
   });

   test("authorize hooks accumulate — both are called in order", async () => {
      const taggedQuery = findAccounts.authorize("admin");
      const registry = new QueryRegistry();
      await registry.register(pluginA, { taggedQuery });

      const order: number[] = [];
      registry.registerAuthorization(() => {
         order.push(1);
      });
      registry.registerAuthorization(() => {
         order.push(2);
      });

      const hash = await taggedQuery.hash;
      await executeRegistry(registry, "pluginA", hash, { email: "a@b.com" }, async () => makeDb([]));

      expect(order).toEqual([1, 2]);
   });

   test("authorize hooks run sequentially — second hook not called if first throws", async () => {
      const taggedQuery = findAccounts.authorize("admin");
      const registry = new QueryRegistry();
      await registry.register(pluginA, { taggedQuery });

      const hook2 = vi.fn();
      registry.registerAuthorization(() => {
         throw new Error("denied");
      });
      registry.registerAuthorization(hook2);

      const hash = await taggedQuery.hash;
      await expect(
         executeRegistry(registry, "pluginA", hash, { email: "a@b.com" }, async () => makeDb([])),
      ).rejects.toMatchInlineSnapshot(`[SqlRunError: Authorization denied for query "taggedQuery". (Error: denied)]`);
      expect(hook2).not.toHaveBeenCalled();
   });

   test(".authorize() on a query preserves the original query's hash", async () => {
      const tagged = findAccounts.authorize("admin");
      expect(await tagged.hash).toBe(await findAccounts.hash);
   });

   // ── getRegisteredQueries ──────────────────────────────────────────────────

   test("getRegisteredQueries returns plugin, hash, name, location, hashId for all registered queries", async () => {
      const registry = new QueryRegistry();
      await registry.register(pluginA, { findAccounts });
      await registry.register(pluginB, { findOrders });

      const entries = registry.getRegisteredQueries();
      expect(entries).toHaveLength(2);

      const a = entries.find((e) => e.name === "findAccounts")!;
      expect(a.plugin).toBe("pluginA");
      expect(a.hash).toBe(await findAccounts.hash);
      expect(typeof a.hashId).toBe("string");

      const b = entries.find((e) => e.name === "findOrders")!;
      expect(b.plugin).toBe("pluginB");
      expect(b.hash).toBe(await findOrders.hash);
   });

   test("getRegisteredQueries returns empty array when nothing is registered", () => {
      const registry = new QueryRegistry();
      expect(registry.getRegisteredQueries()).toEqual([]);
   });

   // ── getExecutionParams ────────────────────────────────────────────────────

   test("getExecutionParams extracts all required fields from a valid request object", () => {
      const registry = new QueryRegistry();
      const input = { plugin: "pluginA", hash: "abc", params: {}, location: "test", mode: "query" as const };
      expect(registry.getExecutionParams(input)).toMatchInlineSnapshot(`
        {
          "hash": "abc",
          "location": "test",
          "mode": "query",
          "params": {},
          "plugin": "pluginA",
        }
      `);
   });

   test("getExecutionParams throws QUERY_PARAMETERS_INVALID when request is not an object", () => {
      const registry = new QueryRegistry();
      expect(() => registry.getExecutionParams(null)).toThrow("Expected request object");
      expect(() => registry.getExecutionParams("string")).toThrow("Expected request object");
      expect(() => registry.getExecutionParams(42)).toThrow("Expected request object");
   });

   test("getExecutionParams throws QUERY_PARAMETERS_INVALID when a required key is missing", () => {
      const registry = new QueryRegistry();
      expect(() =>
         registry.getExecutionParams({ hash: "abc", params: {}, location: "test", mode: "query" }),
      ).toThrow("Missing required parameter in request: plugin");
      expect(() =>
         registry.getExecutionParams({ plugin: "pluginA", params: {}, location: "test", mode: "query" }),
      ).toThrow("Missing required parameter in request: hash");
   });
   test("execute throws when tagged query has no authorize hook registered", async () => {
      const taggedQuery = findAccounts.authorize("admin");
      const registry = new QueryRegistry();
      await registry.register(pluginA, { taggedQuery });

      const hash = await taggedQuery.hash;
      await expect(
         executeRegistry(registry, "pluginA", hash, { email: "a@b.com" }, async () => makeDb([])),
      ).rejects.toMatchInlineSnapshot(
         `[SqlRunError: Query "taggedQuery" requires authorization (tag: "admin") but no authorize hook is registered]`,
      );
   });

   // ── rate limiting ─────────────────────────────────────────────────────────

   test("maxConcurrent option rejects when concurrency limit is reached", async () => {
      const registry = new QueryRegistry({ maxConcurrent: 1 });
      await registry.register(pluginA, { findAccounts });

      const hash = await findAccounts.hash;

      // Create the deferred before starting execute so unblock is set synchronously
      let unblock!: () => void;
      const blocker = new Promise<MockConnection>((resolve) => {
         unblock = () => resolve(makeDb([]));
      });

      const first = executeRegistry(registry, "pluginA", hash, { email: "a@b.com" }, async () => blocker);

      // Yield so the first execute increments inFlight before the second starts
      await Promise.resolve();

      // Second query arrives while first is still in-flight (inFlight === 1 >= maxConcurrent 1)
      const secondError = await executeRegistry(registry, "pluginA", hash, { email: "b@b.com" }, async () =>
         makeDb([]),
      ).catch((e: unknown) => e);

      unblock();
      await first;

      expect(secondError).toMatchInlineSnapshot(
         `[SqlRunError: Query "findAccounts" rejected — concurrency limit of 1 reached (1 in flight)]`,
      );
   });

   test("maxConcurrent allows execution once in-flight drops back below limit", async () => {
      const registry = new QueryRegistry({ maxConcurrent: 1 });
      await registry.register(pluginA, { findAccounts });

      const hash = await findAccounts.hash;

      // First query completes normally (inFlight peaks at 1, then drops to 0)
      await executeRegistry(registry, "pluginA", hash, { email: "a@b.com" }, async () => makeDb([]));

      // Second query should now succeed (inFlight back to 0, well below limit)
      await expect(executeRegistry(registry, "pluginA", hash, { email: "b@b.com" }, async () => makeDb([]))).resolves
         .toMatchInlineSnapshot(`
        {
          "rows": [],
        }
      `);
   });

   // ── AuditLogPlugin contextLogResolver ────────────────────────────────────

   test("contextLog is null when no contextLogResolver is configured", async () => {
      const registry = new QueryRegistry<{ userId: string; secret: string }>();
      await registry.register(pluginA, { findAccounts });

      const onLog = vi.fn();
      registry.use(new AuditLogPlugin<{ userId: string; secret: string }>({ onLog }));

      const hash = await findAccounts.hash;
      await executeRegistry(registry, "pluginA", hash, { email: "a@b.com" }, async () => makeDb([]), {
         userId: "u1",
         secret: "<secret>",
      });

      expect(onLog).toHaveBeenCalledTimes(1);
      expect(onLog).toHaveBeenCalledWith(
         expect.objectContaining({
            context: null,
         }),
      );
   });

   test("contextLog contains only what the resolver returns", async () => {
      const registry = new QueryRegistry<{ userId: string; secret: string }>();
      await registry.register(pluginA, { findAccounts });

      const onLog = vi.fn();
      registry.use(
         new AuditLogPlugin<{ userId: string; secret: string }>({
            contextLogResolver: ({ userId }) => {
               return { userId };
            },
            onLog,
         }),
      );

      const hash = await findAccounts.hash;
      await executeRegistry(registry, "pluginA", hash, { email: "a@b.com" }, async () => makeDb([]), {
         userId: "u1",
         secret: "s3cr3t",
      });

      expect(onLog.mock.calls[0]![0].context).toMatchInlineSnapshot(`
        {
          "userId": "u1",
        }
      `);
   });

   test("raw context is not forwarded to onLog — only contextLog is", async () => {
      const registry = new QueryRegistry<{ userId: string; secret: string }>();
      await registry.register(pluginA, { findAccounts });

      const onLog = vi.fn();
      registry.use(
         new AuditLogPlugin<{ userId: string; secret: string }>({
            contextLogResolver: ({ userId }) => {
               return { userId };
            },
            onLog,
         }),
      );

      const hash = await findAccounts.hash;
      await executeRegistry(registry, "pluginA", hash, { email: "a@b.com" }, async () => makeDb([]), {
         userId: "u1",
         secret: "s3cr3t",
      });

      expect(onLog).toHaveBeenCalledTimes(1);
      expect(onLog).toHaveBeenCalledWith(
         expect.objectContaining({
            name: "findAccounts",
            query: findAccounts,
            plugin: pluginA,
            params: { email: "a@b.com" },
            input: {
               hash,
               plugin: "pluginA",
               location: "test",
               params: { email: "a@b.com" },
               mode: "query",
            } satisfies AfterArgs["input"],
            context: { userId: "u1" },
            error: null,
         }),
      );
   });

   // ── use() / TimeToLiveRateLimiter integration ─────────────────────────────

   test("use() wires TimeToLiveRateLimiter — check() rejects and after() is not called", async () => {
      const limiter = new TimeToLiveRateLimiter({ maxConcurrent: 1 });
      const registry = new QueryRegistry();
      await registry.register(pluginA, { findAccounts });
      registry.use(limiter);

      const hash = await findAccounts.hash;

      let unblock!: () => void;
      const blocker = new Promise<MockConnection>((resolve) => {
         unblock = () => resolve(makeDb([]));
      });

      const first = executeRegistry(registry, "pluginA", hash, { email: "a@b.com" }, async () => blocker);
      await Promise.resolve();

      await expect(
         executeRegistry(registry, "pluginA", hash, { email: "b@b.com" }, async () => makeDb([])),
      ).rejects.toMatchInlineSnapshot(
         `[SqlRunError: Query "findAccounts" rejected — concurrency limit of 1 reached (1 in flight)]`,
      );

      unblock();
      await first;

      expect(limiter.metrics.get(hash)?.totalCalls).toBe(1);
      expect(limiter.metrics.get(hash)?.inFlight).toBe(0);
   });

   test("use() wires TimeToLiveRateLimiter — metrics are updated after successful execution", async () => {
      const limiter = new TimeToLiveRateLimiter();
      const registry = new QueryRegistry();
      await registry.register(pluginA, { findAccounts });
      registry.use(limiter);

      const hash = await findAccounts.hash;
      await executeRegistry(registry, "pluginA", hash, { email: "a@b.com" }, async () => makeDb([]));
      await executeRegistry(registry, "pluginA", hash, { email: "b@b.com" }, async () => makeDb([]));

      const m = limiter.metrics.get(hash)!;
      expect(m.totalCalls).toBe(2);
      expect(m.inFlight).toBe(0);
      expect(m.totalErrors).toBe(0);
      expect(m.avgDurationMs).toBeGreaterThanOrEqual(0);
   });

   test("use() wires TimeToLiveRateLimiter — plain Error from check() is wrapped in SqlRunError", async () => {
      const registry = new QueryRegistry();
      await registry.register(pluginA, { findAccounts });
      registry.use({
         name: "test-limiter",
         check: () => {
            throw new Error("too busy");
         },
         after: () => {},
      });

      const hash = await findAccounts.hash;
      await expect(
         executeRegistry(registry, "pluginA", hash, { email: "a@b.com" }, async () => makeDb([])),
      ).rejects.toMatchInlineSnapshot(`[SqlRunError: Rate limit exceeded for query "findAccounts". (Error: too busy)]`);
   });

   // ── use() — before() / after() fire-and-forget ────────────────────────────

   test("before() fires after checks pass and before query runs — fire and forget", async () => {
      const registry = new QueryRegistry();
      await registry.register(pluginA, { findAccounts });

      const order: string[] = [];
      registry.use({
         name: "observer",
         before: () => {
            order.push("before");
         },
      });

      const hash = await findAccounts.hash;
      await executeRegistry(registry, "pluginA", hash, { email: "a@b.com" }, async () => {
         order.push("query");
         return makeDb([]);
      });

      // yield to let the fire-and-forget before() promise settle
      await Promise.resolve();
      expect(order).toEqual(["before", "query"]);
   });

   test("before() is not called when check() rejects", async () => {
      const registry = new QueryRegistry();
      await registry.register(pluginA, { findAccounts });

      const before = vi.fn();
      registry.use({
         name: "observer",
         check: () => {
            throw new Error("denied");
         },
         before,
      });

      const hash = await findAccounts.hash;
      await expect(
         executeRegistry(registry, "pluginA", hash, { email: "a@b.com" }, async () => makeDb([])),
      ).rejects.toThrow();
      await Promise.resolve();

      expect(before).not.toHaveBeenCalled();
   });

   test("after() fires after query completes — fire and forget", async () => {
      const registry = new QueryRegistry();
      await registry.register(pluginA, { findAccounts });

      const after = vi.fn();
      registry.use({ name: "observer", after });

      const hash = await findAccounts.hash;
      await executeRegistry(registry, "pluginA", hash, { email: "a@b.com" }, async () => makeDb([]));
      await Promise.resolve();

      expect(after).toHaveBeenCalledOnce();
      expect(after).toHaveBeenCalledWith(
         expect.objectContaining({
            name: "findAccounts",
            query: findAccounts,
            plugin: pluginA,
            params: { email: "a@b.com" },
            input: {
               hash,
               plugin: "pluginA",
               location: "test",
               params: { email: "a@b.com" },
               mode: "query",
            } satisfies AfterArgs["input"],
            error: null,
            durationMs: expect.any(Number),
         }),
      );
   });

   test("after() is not called when check() rejects", async () => {
      const registry = new QueryRegistry();
      await registry.register(pluginA, { findAccounts });

      const after = vi.fn();
      registry.use({
         name: "observer",
         check: () => {
            throw new Error("denied");
         },
         after,
      });

      const hash = await findAccounts.hash;
      await expect(
         executeRegistry(registry, "pluginA", hash, { email: "a@b.com" }, async () => makeDb([])),
      ).rejects.toThrow();
      await Promise.resolve();

      expect(after).not.toHaveBeenCalled();
   });

   // ── use() — onError / onPluginError ───────────────────────────────────────

   test("plugin.onError is called when after() throws — phase carries AfterArgs", async () => {
      const registry = new QueryRegistry();
      await registry.register(pluginA, { findAccounts });

      const onError = vi.fn();
      registry.use({
         name: "failing-plugin",
         after: () => {
            throw new Error("after failed");
         },
         onError,
      });

      const hash = await findAccounts.hash;
      await executeRegistry(registry, "pluginA", hash, { email: "a@b.com" }, async () => makeDb([]));
      await Promise.resolve();

      expect(onError).toHaveBeenCalledOnce();
      expect(onError).toHaveBeenCalledWith(
         expect.any(Error),
         expect.objectContaining({
            after: expect.objectContaining({
               name: "findAccounts",
               query: findAccounts,
               plugin: pluginA,
               params: { email: "a@b.com" },
               input: {
                  hash,
                  plugin: "pluginA",
                  location: "test",
                  params: { email: "a@b.com" },
                  mode: "query",
               } satisfies AfterArgs["input"],
               error: null,
            }),
         }),
      );
   });

   test("onPluginError registry option is called when after() throws and plugin has no onError", async () => {
      const onPluginError = vi.fn();
      const registry = new QueryRegistry({ onPluginError });
      await registry.register(pluginA, { findAccounts });

      registry.use({
         name: "failing-plugin",
         after: () => {
            throw new Error("after failed");
         },
      });

      const hash = await findAccounts.hash;
      await executeRegistry(registry, "pluginA", hash, { email: "a@b.com" }, async () => makeDb([]));
      await Promise.resolve();

      expect(onPluginError).toHaveBeenCalledOnce();
      expect(onPluginError).toHaveBeenCalledWith(
         expect.any(Error),
         expect.objectContaining({ name: "failing-plugin" }),
         expect.objectContaining({
            after: expect.objectContaining({
               name: "findAccounts",
               query: findAccounts,
               plugin: pluginA,
               params: { email: "a@b.com" },
               input: {
                  hash,
                  plugin: "pluginA",
                  location: "test",
                  params: { email: "a@b.com" },
                  mode: "query",
               } satisfies AfterArgs["input"],
               error: null,
            }),
         }),
      );
   });

   test("plugin.onError takes precedence over onPluginError", async () => {
      const onPluginError = vi.fn();
      const onError = vi.fn();
      const registry = new QueryRegistry({ onPluginError });
      await registry.register(pluginA, { findAccounts });

      registry.use({
         name: "failing-plugin",
         after: () => {
            throw new Error("after failed");
         },
         onError,
      });

      const hash = await findAccounts.hash;
      await executeRegistry(registry, "pluginA", hash, { email: "a@b.com" }, async () => makeDb([]));
      await Promise.resolve();

      expect(onError).toHaveBeenCalledOnce();
      expect(onPluginError).not.toHaveBeenCalled();
   });

   test("process.emitWarning is called when onError itself throws", async () => {
      const registry = new QueryRegistry();
      await registry.register(pluginA, { findAccounts });

      const warnSpy = vi.spyOn(process, "emitWarning").mockImplementation(() => {});
      registry.use({
         name: "broken-plugin",
         after: () => {
            throw new Error("after failed");
         },
         onError: () => {
            throw new Error("onError failed");
         },
      });

      const hash = await findAccounts.hash;
      await executeRegistry(registry, "pluginA", hash, { email: "a@b.com" }, async () => makeDb([]));
      await Promise.resolve();

      expect(warnSpy).toHaveBeenCalledOnce();
      expect(warnSpy).toHaveBeenCalledWith(
         expect.stringContaining(`QueryExecutionPlugin "broken-plugin" onError threw during "after" phase`),
      );
      warnSpy.mockRestore();
   });
});

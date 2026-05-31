import { describe, expect, test, vi } from "vitest";
import { QueryRegistry } from "#/registry/query-registry.js";
import { sql } from "#/core/sql.js";
import { row } from "#/core/query/sql-select-row.js";
import { param } from "#/core/query/sql-param.js";
import { SqlQueryHandler, newSqlQueryHandler } from "#/core/query/sql-query-handler.js";
import { SqlQuery, SqlQueryAny } from "#/core/query/sql-query.js";
import { VexnorPlugin } from "#/plugin/vexnor-plugin.js";
import { SqlRunArgs } from "#/core/query/sql-query-types.js";
import { Account } from "@test-models/vexnor_dev.account-table.js";
import { Order } from "@test-models/vexnor_dev.order-table.js";
import { SqlRunError } from "#/core/sql-run-error.js";
import { ok } from "node:assert";

// ── minimal mock infrastructure ──────────────────────────────────────────────

type MockResult = { rows: unknown[] };
type MockConnection = { query: (sql: string, params: unknown[]) => Promise<MockResult> };

class MockQueryHandler<T extends { Row?: unknown; Params?: unknown }> extends SqlQueryHandler<
   Pick<T, "Row" | "Params"> & { QueryResult: MockResult; Connection: MockConnection }
> {
   constructor(private readonly q: SqlQuery<Pick<T, "Row" | "Params">>) {
      super(q);
   }
   resolveRows(result: MockResult): T["Row"][] {
      return result.rows as T["Row"][];
   }
   deserialize(result: MockResult, remote: boolean): MockResult {
      return { ...result, rows: this.deserializeRows(result.rows as T["Row"][], remote) };
   }
   async execute(args: SqlRunArgs<{ Connection: MockConnection; Params: T["Params"] }>): Promise<MockResult> {
      const db = await args.db;
      const { text, values } = this.q.getSql(args);
      return db.query(text, values);
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

// ── tests ────────────────────────────────────────────────────────────────────

describe("QueryRegistry", () => {
   test("register stores queries for two plugins and execute runs each independently", async () => {
      const registry = new QueryRegistry();
      await registry.register(pluginA, { findAccounts });
      await registry.register(pluginB, { findOrders });

      const hashA = await findAccounts.hash;
      const hashB = await findOrders.hash;

      const resultA = await registry.execute("pluginA", hashA, { email: "a@b.com" }, async () =>
         makeDb([{ accountId: "1", email: "a@b.com" }]),
      );
      const resultB = await registry.execute("pluginB", hashB, {}, async () =>
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
         registry.execute("pluginB", hashA, { email: "a@b.com" }, async () => makeDb()),
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

      expect(await registry.execute("pluginA", hashA, { email: "x@y.com" }, async () => makeDb([])))
         .toMatchInlineSnapshot(`
           {
             "rows": [],
           }
         `);
      expect(await registry.execute("pluginB", hashB, {}, async () => makeDb([]))).toMatchInlineSnapshot(`
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
      await expect(registry.execute("pluginA", hashA, {}, async () => makeDb())).rejects.toMatchInlineSnapshot(
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

      const r1 = await registry.execute("pluginA", h1, { email: "a@b.com" }, async () => makeDb([{ accountId: "1" }]));
      const r2 = await registry.execute("pluginA", h2, {}, async () => makeDb([{ accountId: "2" }]));
      const rB = await registry.execute("pluginB", hB, {}, async () => makeDb([{ orderId: "o1" }]));

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

      await expect(registry.execute("pluginA", "deadbeef", {}, async () => makeDb())).rejects.toMatchInlineSnapshot(
         `[SqlError: Unknown query hash: deadbeef for plugin: pluginA]`,
      );

      await expect(registry.execute("pluginB", "deadbeef", {}, async () => makeDb())).rejects.toMatchInlineSnapshot(
         `[SqlError: Unknown query hash: deadbeef for plugin: pluginB]`,
      );
   });

   test("execute throws for unknown plugin name", async () => {
      const registry = new QueryRegistry();

      await expect(registry.execute("ghost", "deadbeef", {}, async () => makeDb())).rejects.toMatchInlineSnapshot(
         `[SqlError: Unknown query hash: deadbeef for plugin: ghost]`,
      );
   });

   test("execute throws assertion error when plugin missing after map entry exists", async () => {
      const registry = new QueryRegistry();
      await registry.register(pluginA, { findAccounts });
      await registry.register(pluginB, { findOrders });

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (registry as any).plugins.delete("pluginA");

      const hash = await findAccounts.hash;
      await expect(
         registry.execute("pluginA", hash, { email: "a@b.com" }, async () => makeDb()),
      ).rejects.toMatchInlineSnapshot(`[Error: Unknown plugin: pluginA]`);

      // pluginB must still work
      const hashB = await findOrders.hash;
      await expect(registry.execute("pluginB", hashB, {}, async () => makeDb([]))).resolves.toMatchInlineSnapshot(`
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

      await registry.execute("pluginA", hashA, { email: "z@z.com" }, resolverA);
      await registry.execute("pluginB", hashB, {}, resolverB);

      expect(resolverA).toHaveBeenCalledOnce();
      expect(resolverA).toHaveBeenCalledWith("pluginA");
      expect(resolverB).toHaveBeenCalledOnce();
      expect(resolverB).toHaveBeenCalledWith("pluginB");
   });

   // ── register filtering ────────────────────────────────────────────────────

   test("register stores query name from object key and it appears in audit log", async () => {
      const registry = new QueryRegistry();
      await registry.register(pluginA, { findAccounts });

      const hook = vi.fn();
      registry.registerAuditLog(hook);

      const hash = await findAccounts.hash;
      await registry.execute("pluginA", hash, { email: "a@b.com" }, async () => makeDb([]));

      expect(hook).toHaveBeenCalledWith(
         expect.objectContaining({ args: expect.objectContaining({ queryName: "findAccounts" }) }),
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
      const err = await registry
         .execute("pluginA", hash, { email: "x" }, async () => ({
            query: async () => {
               throw new Error("db failure");
            },
         }))
         .catch((e: unknown) => e);

      ok(err instanceof SqlRunError);
      expect(err.queryName).toBe("findAccounts");
   });

   // ── registerAuditLog ──────────────────────────────────────────────────

   test("audit log hook is called after successful execution", async () => {
      const registry = new QueryRegistry();
      await registry.register(pluginA, { findAccounts });

      const hook = vi.fn();
      registry.registerAuditLog(hook);

      const hash = await findAccounts.hash;
      await registry.execute("pluginA", hash, { email: "a@b.com" }, async () => makeDb([]));

      expect(hook).toHaveBeenCalledOnce();
      expect(hook).toHaveBeenCalledWith(
         expect.objectContaining({
            args: expect.objectContaining({
               query: findAccounts,
               plugin: pluginA,
               params: { email: "a@b.com" },
               error: null,
               durationMs: expect.any(Number),
            }),
         }),
      );
   });

   test("audit log hook is called after failed execution with the error", async () => {
      const registry = new QueryRegistry();
      await registry.register(pluginA, { findAccounts });

      const hook = vi.fn();
      registry.registerAuditLog(hook);

      const hash = await findAccounts.hash;
      await expect(
         registry.execute("pluginA", hash, { email: "a@b.com" }, async () => ({
            query: async () => {
               throw new Error("db failure");
            },
         })),
      ).rejects.toThrow();

      expect(hook).toHaveBeenCalledOnce();
      expect(hook).toHaveBeenCalledWith(
         expect.objectContaining({ args: expect.objectContaining({ error: expect.any(Error) }) }),
      );
   });

   test("audit log hooks accumulate and run sequentially", async () => {
      const registry = new QueryRegistry();
      await registry.register(pluginA, { findAccounts });

      const order: number[] = [];
      registry.registerAuditLog(() => {
         order.push(1);
      });
      registry.registerAuditLog(() => {
         order.push(2);
      });

      const hash = await findAccounts.hash;
      await registry.execute("pluginA", hash, { email: "a@b.com" }, async () => makeDb([]));

      expect(order).toEqual([1, 2]);
   });

   test("audit log hook fires even when authorization denies execution", async () => {
      const taggedQuery = findAccounts.authorize("admin");
      const registry = new QueryRegistry();
      await registry.register(pluginA, { taggedQuery });
      registry.registerAuthorization(() => {
         throw new Error("denied");
      });

      const hook = vi.fn();
      registry.registerAuditLog(hook);

      const hash = await taggedQuery.hash;
      await expect(registry.execute("pluginA", hash, { email: "a@b.com" }, async () => makeDb([]))).rejects.toThrow(
         "denied",
      );

      expect(hook).toHaveBeenCalledOnce();
      expect(hook).toHaveBeenCalledWith(
         expect.objectContaining({ args: expect.objectContaining({ error: expect.any(Error) }) }),
      );
   });

   // ── authorize hook ────────────────────────────────────────────────────────

   test("authorize hook receives the authorization of a tagged query", async () => {
      const taggedQuery = findAccounts.authorize("admin");
      const registry = new QueryRegistry();
      await registry.register(pluginA, { taggedQuery });

      const hook = vi.fn();
      registry.registerAuthorization(hook);

      const hash = await taggedQuery.hash;
      await registry.execute("pluginA", hash, { email: "a@b.com" }, async () => makeDb([]));

      expect(hook).toHaveBeenCalledOnce();
      expect(hook).toHaveBeenCalledWith({
         plugin: pluginA,
         query: taggedQuery,
         queryName: "taggedQuery",
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
      await registry.execute("pluginA", hash, { email: "a@b.com" }, async () => makeDb([]));

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

      await expect(registry.execute("pluginA", hash, { email: "a@b.com" }, resolver)).rejects.toMatchInlineSnapshot(
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
      await registry.execute("pluginA", hash, { email: "a@b.com" }, async () => makeDb([]));

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
         registry.execute("pluginA", hash, { email: "a@b.com" }, async () => makeDb([])),
      ).rejects.toMatchInlineSnapshot(`[SqlRunError: Authorization denied for query "taggedQuery". (Error: denied)]`);
      expect(hook2).not.toHaveBeenCalled();
   });

   test(".authorize() on a query preserves the original query's hash", async () => {
      const tagged = findAccounts.authorize("admin");
      expect(await tagged.hash).toBe(await findAccounts.hash);
   });

   test("execute throws when tagged query has no authorize hook registered", async () => {
      const taggedQuery = findAccounts.authorize("admin");
      const registry = new QueryRegistry();
      await registry.register(pluginA, { taggedQuery });

      const hash = await taggedQuery.hash;
      await expect(
         registry.execute("pluginA", hash, { email: "a@b.com" }, async () => makeDb([])),
      ).rejects.toMatchInlineSnapshot(
         `[SqlRunError: Query "taggedQuery" requires authorization (tag: "admin") but no authorize hook is registered]`,
      );
   });
});

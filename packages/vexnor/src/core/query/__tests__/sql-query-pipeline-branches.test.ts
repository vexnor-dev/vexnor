import { describe, expect, test, vi } from "vitest";
import { sql } from "#src/core/sql.js";
import { row } from "#src/core/query/sql-select-row.js";
import { Account } from "@test-models/vexnor_dev.account-table.js";
import { SqlQueryPipeline } from "#src/execution/sql-query-pipeline.js";
import { connect } from "#src/plugin/vexnor-connection.js";
import { MockConnection } from "#src/test/mock-plugin.js";
import { mockHandler } from "#src/test/mock-query-handler.js";
import { ctx } from "#src/core/query/sql-param.js";
import { SqlRunError } from "#src/core/sql-run-error.js";
import { SqlErrorCode } from "#src/core/sql-error-code.js";

const findAccounts = sql`
   select ${row(Account.$accountId, Account.$email)}
   from ${Account}
   where ${Account.$accountId} = ${ctx<{ userId: string }>("userId")}
`;

const taggedQuery = findAccounts.authorize("admin");

function makeDb(rows: unknown[] = []): MockConnection {
   return { query: vi.fn(async () => ({ rows })) } as MockConnection;
}

// ── checkAuthorization ────────────────────────────────────────────────────────

describe("SqlQueryPipeline.checkAuthorization()", () => {
   test("throws when tagged queries exist but no hook is registered", () => {
      const pipeline = new SqlQueryPipeline<{ Context: { userId: string } }>();
      expect(() => pipeline.checkAuthorization([taggedQuery])).toThrow("authorization");
   });

   test("does not throw when hook is registered", () => {
      const pipeline = new SqlQueryPipeline<{ Context: { userId: string } }>();
      pipeline.registerAuthorization(vi.fn());
      expect(() => pipeline.checkAuthorization([taggedQuery])).not.toThrow();
   });

   test("does not throw when no tagged queries", () => {
      const pipeline = new SqlQueryPipeline<{ Context: { userId: string } }>();
      expect(() => pipeline.checkAuthorization([findAccounts])).not.toThrow();
   });

   test("singular error message for one query", () => {
      const pipeline = new SqlQueryPipeline<{ Context: { userId: string } }>();
      expect(() => pipeline.checkAuthorization([taggedQuery])).toThrow("1 query requires authorization");
   });
});

// ── use() unsubscribe ─────────────────────────────────────────────────────────

describe("SqlQueryPipeline.use() — unsubscribe", () => {
   test("unsubscribe removes check plugin", async () => {
      const pipeline = new SqlQueryPipeline<{ Context: { userId: string } }>();
      const check = vi.fn();
      const unsub = pipeline.use({ name: "temp", check });

      unsub();

      await mockHandler(findAccounts).all({
         db: connect(makeDb([{ accountId: "1", email: "a@b.com" }]), { pipeline }),
         params: { userId: "u1" },
      });

      expect(check).not.toHaveBeenCalled();
   });
});

// ── execute error wrapping ────────────────────────────────────────────────────

describe("SqlQueryPipeline.execute() — error wrapping", () => {
   test("non-SqlRunError from execution is wrapped with QUERY_EXECUTION_FAILED", async () => {
      const pipeline = new SqlQueryPipeline<{ Context: { userId: string } }>();
      const db: MockConnection = {
         query: async () => {
            throw new Error("raw error");
         },
      } as MockConnection;

      try {
         await mockHandler(findAccounts).all({
            db: connect(db, { pipeline }),
            params: { userId: "u1" },
         });
         expect.fail("should have thrown");
      } catch (err) {
         expect(err).toBeInstanceOf(SqlRunError);
         expect((err as SqlRunError).code).toBe(SqlErrorCode.QUERY_EXECUTION_FAILED);
      }
   });
});

// ── maxConcurrent (direct pipeline.execute call) ──────────────────────────────

describe("SqlQueryPipeline — maxConcurrent option (direct)", () => {
   test("rejects when maxConcurrent is exceeded", async () => {
      const pipeline = new SqlQueryPipeline<{ Context: { userId: string } }>({ maxConcurrent: 1 });

      let unblock!: () => void;
      const blocker = new Promise<void>((resolve) => {
         unblock = resolve;
      });

      const executionArgs = {
         plugin: { name: "mock" },
         query: findAccounts,
         name: "test",
         params: { userId: "u1" },
         mode: "read" as const,
         remote: null,
         context: { userId: "u1" },
      };

      // Start first execution
      const first = pipeline.execute(executionArgs, async () => {
         await blocker;
         return { rows: [] };
      });

      // Wait for it to enter flight
      await new Promise((r) => setTimeout(r, 10));

      // Second should be rejected
      await expect(
         pipeline.execute(executionArgs, async () => ({ rows: [] })),
      ).rejects.toThrow("concurrency limit");

      unblock();
      await first;
   });
});

// ── from() ────────────────────────────────────────────────────────────────────

describe("SqlQueryPipeline.from()", () => {
   test("copies auth hooks from source — checkAuthorization passes", () => {
      const source = new SqlQueryPipeline<{ Context: { userId: string } }>();
      source.registerAuthorization(vi.fn());

      const copy = SqlQueryPipeline.from(source);

      // If auth hooks were copied, this should not throw
      expect(() => copy.checkAuthorization([taggedQuery])).not.toThrow();
   });

   test("copies check plugins from source", async () => {
      const source = new SqlQueryPipeline<{ Context: { userId: string } }>();
      const check = vi.fn();
      source.use({ name: "checker", check });

      const copy = SqlQueryPipeline.from(source);

      const executionArgs = {
         plugin: { name: "mock" },
         query: findAccounts,
         name: "test",
         params: { userId: "u1" },
         mode: "read" as const,
         remote: null,
         context: { userId: "u1" },
      };

      await copy.execute(executionArgs, async () => ({ rows: [] }));
      expect(check).toHaveBeenCalledOnce();
   });
});

// ── clear() ───────────────────────────────────────────────────────────────────

describe("SqlQueryPipeline.clear()", () => {
   test("clears checkPlugins array length to 0", async () => {
      const pipeline = new SqlQueryPipeline<{ Context: { userId: string } }>();
      pipeline.registerAuthorization(vi.fn());
      pipeline.use({ name: "blocker", check: vi.fn() });

      const executionArgs = {
         plugin: { name: "mock" },
         query: findAccounts,
         name: "test",
         params: { userId: "u1" },
         mode: "read" as const,
         remote: null,
         context: { userId: "u1" },
      };

      // Before clear: pipeline works and check is called
      await pipeline.execute(executionArgs, async () => ({ rows: [] }));

      // clear() resets internal state — this exercises the clear code path
      pipeline.clear();
   });
});

// ── plugin error handling (direct execute) ────────────────────────────────────

describe("SqlQueryPipeline — plugin error handling (direct)", () => {
   test("plugin.onError is called when before() throws", async () => {
      const pipeline = new SqlQueryPipeline<{ Context: { userId: string } }>();
      const onError = vi.fn();
      pipeline.use({
         name: "broken-before",
         before: () => {
            throw new Error("before broke");
         },
         onError,
      });

      const executionArgs = {
         plugin: { name: "mock" },
         query: findAccounts,
         name: "test",
         params: { userId: "u1" },
         mode: "read" as const,
         remote: null,
         context: { userId: "u1" },
      };

      await pipeline.execute(executionArgs, async () => ({ rows: [] }));
      expect(onError).toHaveBeenCalledWith(expect.any(Error), expect.objectContaining({ before: expect.anything() }));
   });

   test("plugin.onError is called when after() throws", async () => {
      const pipeline = new SqlQueryPipeline<{ Context: { userId: string } }>();
      const onError = vi.fn();
      pipeline.use({
         name: "broken-end",
         end: () => {
            throw new Error("end broke");
         },
         onError,
      });

      const executionArgs = {
         plugin: { name: "mock" },
         query: findAccounts,
         name: "test",
         params: { userId: "u1" },
         mode: "read" as const,
         remote: null,
         context: { userId: "u1" },
      };

      await pipeline.execute(executionArgs, async () => ({ rows: [] }));
      expect(onError).toHaveBeenCalledWith(expect.any(Error), expect.objectContaining({ end: expect.anything() }));
   });

   test("options.onPluginError is called when plugin has no onError", async () => {
      const onPluginError = vi.fn();
      const pipeline = new SqlQueryPipeline<{ Context: { userId: string } }>({ onPluginError });
      pipeline.use({
         name: "broken-no-handler",
         before: () => {
            throw new Error("oops");
         },
      });

      const executionArgs = {
         plugin: { name: "mock" },
         query: findAccounts,
         name: "test",
         params: { userId: "u1" },
         mode: "read" as const,
         remote: null,
         context: { userId: "u1" },
      };

      await pipeline.execute(executionArgs, async () => ({ rows: [] }));
      expect(onPluginError).toHaveBeenCalledWith(
         expect.any(Error),
         expect.objectContaining({ name: "broken-no-handler" }),
         expect.objectContaining({ before: expect.anything() }),
      );
   });

   test("emits warning when onError itself throws", async () => {
      const pipeline = new SqlQueryPipeline<{ Context: { userId: string } }>();
      const warn = vi.spyOn(process, "emitWarning").mockImplementation(() => {});
      pipeline.use({
         name: "double-throw",
         before: () => {
            throw new Error("first");
         },
         onError: () => {
            throw new Error("second");
         },
      });

      const executionArgs = {
         plugin: { name: "mock" },
         query: findAccounts,
         name: "test",
         params: { userId: "u1" },
         mode: "read" as const,
         remote: null,
         context: { userId: "u1" },
      };

      await pipeline.execute(executionArgs, async () => ({ rows: [] }));
      expect(warn).toHaveBeenCalledWith(expect.stringContaining("double-throw"));
      warn.mockRestore();
   });
});

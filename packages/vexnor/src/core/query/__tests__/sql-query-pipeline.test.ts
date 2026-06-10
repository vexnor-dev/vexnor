import "../../../test/mock-query-handler.js";
import { describe, expect, test, vi } from "vitest";
import { sql } from "#/core/sql.js";
import { row } from "#/core/query/sql-select-row.js";
import { Account } from "@test-models/vexnor_dev.account-table.js";
import { SqlQueryPipeline } from "#/execution/sql-query-pipeline.js";
import { AuditLogPlugin } from "#/execution/audit-log-plugin.js";
import { TimeToLiveRateLimiter } from "#/execution/time-to-live-rate-limiter.js";
import { connect } from "#/plugin/vexnor-connection.js";
import { MockConnection } from "#/test/mock-plugin.js";
import { mockHandler } from "#/test/mock-query-handler.js";
import { ctx } from "#/core/query/sql-param.js";

type MockAccount = { accountId: string; email: string };

const mockAccount: MockAccount = { accountId: "1", email: "test@example.com" };

/**
 * Uses ctx() so context is { userId: string } — the value is injected
 * from the connection context rather than caller-supplied params.
 */
const findAccountsByOwner = sql`
   select ${row(Account.$accountId, Account.$email)}
   from ${Account}
   where ${Account.$accountId} = ${ctx<{ userId: string }>("userId")}
`;

const taggedQuery = findAccountsByOwner.authorize("admin");

function makeDb(rows: unknown[] = []): MockConnection {
   return { query: vi.fn(async () => ({ rows })) } as MockConnection;
}

function makeConnection<TContext extends Record<string, unknown>>(
   db: MockConnection,
   pipeline: SqlQueryPipeline<{ Context: TContext }>,
) {
   return connect<TContext, MockConnection>(db, { pipeline });
}

// ── authorization ─────────────────────────────────────────────────────────────

describe("SqlQueryPipeline via connect() — authorization", () => {
   test("authorization hook is called for tagged query with context", async () => {
      const pipeline = new SqlQueryPipeline<{ Context: { userId: string } }>();
      const hook = vi.fn();
      pipeline.registerAuthorization(hook);

      const handler = mockHandler(taggedQuery);
      await handler.all({
         db: makeConnection(makeDb([mockAccount]), pipeline),
         params: { userId: "u1" },
      });

      expect(hook).toHaveBeenCalledOnce();
      expect(hook).toHaveBeenCalledWith(
         expect.objectContaining({
            query: handler.source,
            context: { userId: "u1" },
            params: { userId: "u1" },
            plugin: expect.objectContaining({ name: "mock" }),
            name: findAccountsByOwner.id,
         }),
      );
   });

   test("authorization hook is not called for untagged query", async () => {
      const pipeline = new SqlQueryPipeline<{ Context: { userId: string } }>();
      const hook = vi.fn();
      pipeline.registerAuthorization(hook);

      await mockHandler(findAccountsByOwner).all({
         db: makeConnection(makeDb([mockAccount]), pipeline),
         params: { userId: "u1" },
      });

      expect(hook).not.toHaveBeenCalled();
   });

   test("authorization hook throwing denies execution — db is never called", async () => {
      const pipeline = new SqlQueryPipeline<{ Context: { userId: string } }>();
      pipeline.registerAuthorization(() => {
         throw new Error("forbidden");
      });

      const db = makeDb([]);
      await expect(
         mockHandler(taggedQuery).all({
            db: makeConnection(db, pipeline),
            params: { userId: "u1" },
         }),
      ).rejects.toThrow("forbidden");

      expect(db.query).not.toHaveBeenCalled();
   });

   test("tagged query with no authorization hook throws QUERY_NOT_AUTHORIZED", async () => {
      const pipeline = new SqlQueryPipeline<{ Context: { userId: string } }>();

      await expect(
         mockHandler(taggedQuery).all({
            db: makeConnection(makeDb([]), pipeline),
            params: { userId: "u1" },
         }),
      ).rejects.toMatchInlineSnapshot(
         `[SqlRunError: Query "SqlQuery#1" requires authorization (tag: "admin") but no authorize hook is registered]`,
      );
   });

   test("tagged query against raw db with no pipeline executes without authorization check", async () => {
      const db = makeDb([mockAccount]);

      // No VexnorConnection, no pipeline — authorization is not enforced
      const result = await mockHandler(taggedQuery).all({
         db,
         params: { userId: "u1" },
      });

      expect(result).toEqual([mockAccount]);
      expect(db.query).toHaveBeenCalledOnce();
   });
});

// ── rate limiting ─────────────────────────────────────────────────────────────

describe("SqlQueryPipeline via connect() — rate limiting", () => {
   test("check() plugin rejects when limit is hit — db is never called", async () => {
      const pipeline = new SqlQueryPipeline<{ Context: { userId: string } }>();
      pipeline.use({
         name: "blocker",
         check: () => {
            throw new Error("too busy");
         },
      });

      const db = makeDb([]);
      await expect(
         mockHandler(findAccountsByOwner).all({
            db: makeConnection(db, pipeline),
            params: { userId: "u1" },
         }),
      ).rejects.toThrow("too busy");

      expect(db.query).not.toHaveBeenCalled();
   });

   test("TimeToLiveRateLimiter attached to pipeline rejects when maxConcurrent is reached", async () => {
      const pipeline = new SqlQueryPipeline<{ Context: { userId: string } }>();
      const limiter = new TimeToLiveRateLimiter({ maxConcurrent: 1 });
      pipeline.use(limiter);

      let unblock!: () => void;
      const blocker = new Promise<void>((resolve) => {
         unblock = resolve;
      });

      const slowDb: MockConnection = {
         query: async () => {
            await blocker;
            return { rows: [mockAccount] };
         },
      } as MockConnection;

      const first = mockHandler(findAccountsByOwner).all({
         db: makeConnection(slowDb, pipeline),
         params: { userId: "u1" },
      });

      await Promise.resolve();

      await expect(
         mockHandler(findAccountsByOwner).all({
            db: makeConnection(makeDb([]), pipeline),
            params: { userId: "u2" },
         }),
      ).rejects.toThrow("concurrency limit");

      unblock();
      await first;
   });

   test("TimeToLiveRateLimiter metrics are updated after execution via connect()", async () => {
      const pipeline = new SqlQueryPipeline<{ Context: { userId: string } }>();
      const limiter = new TimeToLiveRateLimiter();
      pipeline.use(limiter);

      await mockHandler(findAccountsByOwner).all({
         db: makeConnection(makeDb([mockAccount]), pipeline),
         params: { userId: "u1" },
      });
      await Promise.resolve();

      const id = findAccountsByOwner.id;
      expect(limiter.metrics.get(id)?.totalCalls).toBe(1);
      expect(limiter.metrics.get(id)?.inFlight).toBe(0);
   });
});

// ── audit log ─────────────────────────────────────────────────────────────────

describe("SqlQueryPipeline via connect() — audit log", () => {
   test("AuditLogPlugin onLog fires after successful execution", async () => {
      const pipeline = new SqlQueryPipeline<{ Context: { userId: string } }>();
      const onLog = vi.fn();
      pipeline.use(new AuditLogPlugin({ onLog }));

      await mockHandler(findAccountsByOwner).all({
         db: makeConnection(makeDb([mockAccount]), pipeline),
         params: { userId: "u1" },
      });
      await Promise.resolve();

      expect(onLog).toHaveBeenCalledOnce();
      expect(onLog).toHaveBeenCalledWith(
         expect.objectContaining({
            error: null,
            durationMs: expect.any(Number),
            params: { userId: "u1" },
            context: null,
         }),
      );
   });

   test("AuditLogPlugin onLog fires after failed execution with the error", async () => {
      const pipeline = new SqlQueryPipeline<{ Context: { userId: string } }>();
      const onLog = vi.fn();
      pipeline.use(new AuditLogPlugin({ onLog }));

      const db: MockConnection = {
         query: async () => {
            throw new Error("db failure");
         },
      } as MockConnection;

      await expect(
         mockHandler(findAccountsByOwner).all({
            db: makeConnection(db, pipeline),
            params: { userId: "u1" },
         }),
      ).rejects.toThrow();
      await Promise.resolve();

      expect(onLog).toHaveBeenCalledOnce();
      expect(onLog).toHaveBeenCalledWith(expect.objectContaining({ error: expect.any(Error) }));
   });

   test("AuditLogPlugin contextLogResolver projects context — raw context not forwarded", async () => {
      const pipeline = new SqlQueryPipeline<{ Context: { userId: string } }>();
      const onLog = vi.fn();
      pipeline.use(
         new AuditLogPlugin<{ userId: string }>({
            contextLogResolver: ({ userId }) => ({ userId }),
            onLog,
         }),
      );

      await mockHandler(findAccountsByOwner).all({
         db: makeConnection(makeDb([mockAccount]), pipeline),
         params: { userId: "u1" },
      });
      await Promise.resolve();

      expect(onLog).toHaveBeenCalledOnce();
      expect(onLog).toHaveBeenCalledWith(expect.objectContaining({
         context: { userId: "u1" },
      }));
   });

   test("AuditLogPlugin fires even when authorization denies execution", async () => {
      const pipeline = new SqlQueryPipeline<{ Context: { userId: string } }>();
      const onLog = vi.fn();
      pipeline.use(new AuditLogPlugin({ onLog }));
      pipeline.registerAuthorization(() => {
         throw new Error("denied");
      });

      await expect(
         mockHandler(taggedQuery).all({
            db: makeConnection(makeDb([]), pipeline),
            params: { userId: "u1" },
         }),
      ).rejects.toThrow("denied");
      await Promise.resolve();

      expect(onLog).toHaveBeenCalledOnce();
      expect(onLog).toHaveBeenCalledWith(expect.objectContaining({ error: expect.any(Error) }));
   });
});

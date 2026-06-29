import "../../../test/mock-query-handler.js";
import { describe, expect, test, vi } from "vitest";
import { sql } from "#src/core/sql.js";
import { row } from "#src/core/query/sql-select-row.js";
import { Account } from "@test-models/vexnor_dev.account-table.js";
import { SqlQueryPipeline } from "#src/execution/sql-query-pipeline.js";
import { TimeToLiveRateLimiter } from "#src/execution/time-to-live-rate-limiter.js";
import { connect } from "#src/plugin/vexnor-connection.js";
import { MockConnection } from "#src/test/mock-plugin.js";
import { mockHandler } from "#src/test/mock-query-handler.js";
import { ctx } from "#src/core/query/sql-param.js";

type MockAccount = { accountId: string; email: string };

const mockAccount: MockAccount = { accountId: "1", email: "test@example.com" };

const findAccountsByOwner = sql`
   select ${row(Account.$accountId, Account.$email)}
   from ${Account}
   where ${Account.$accountId} = ${ctx<{ userId: string }>("userId")}
`;

function makeDb(rows: unknown[] = []): MockConnection {
   return { query: vi.fn(async () => ({ rows })) } as MockConnection;
}

function makeConnection<TContext extends Record<string, unknown>>(
   db: MockConnection,
   pipeline: SqlQueryPipeline<{ Context: TContext }>,
) {
   return connect<TContext, MockConnection>(db, { pipeline });
}

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

describe("SqlQueryPipeline — init/end lifecycle guarantees", () => {
   test("init() fires and increments inFlight before authorize() runs", async () => {
      const events: string[] = [];
      const pipeline = new SqlQueryPipeline<{ Context: { userId: string } }>();
      pipeline.use(
         new TimeToLiveRateLimiter<{ userId: string }>({
            name: "limiter",
         }),
      );
      // Register auth hook that captures inFlight at the time it runs
      pipeline.registerAuthorization(({ query }) => {
         const limiter = pipeline["checkPlugins"][0] as TimeToLiveRateLimiter<{ userId: string }>;
         const m = limiter.metrics.get(query.id);
         events.push(`authorize:inFlight=${m?.inFlight}`);
      });

      const tagged = findAccountsByOwner.authorize("user");
      await mockHandler(tagged).all({
         db: makeConnection(makeDb([mockAccount]), pipeline),
         params: { userId: "u1" },
      });

      // init() should have incremented inFlight BEFORE authorize() saw it
      expect(events).toEqual(["authorize:inFlight=1"]);
   });

   test("init() fires and increments inFlight before check() runs", async () => {
      const pipeline = new SqlQueryPipeline<{ Context: { userId: string } }>();
      let inFlightDuringCheck = -1;
      const limiter = new TimeToLiveRateLimiter<{ userId: string }>({
         name: "limiter",
         limit: ({ queryMetrics }) => {
            inFlightDuringCheck = queryMetrics.inFlight;
         },
      });
      pipeline.use(limiter);

      await mockHandler(findAccountsByOwner).all({
         db: makeConnection(makeDb([mockAccount]), pipeline),
         params: { userId: "u1" },
      });

      // inFlight should be 1 when check/limit runs (init already incremented)
      expect(inFlightDuringCheck).toBe(1);
   });

   test("end() decrements inFlight even when authorization rejects", async () => {
      const pipeline = new SqlQueryPipeline<{ Context: { userId: string } }>();
      const limiter = new TimeToLiveRateLimiter<{ userId: string }>({ name: "limiter" });
      pipeline.use(limiter);
      pipeline.registerAuthorization(() => {
         throw new Error("denied");
      });

      const tagged = findAccountsByOwner.authorize("user");
      await expect(
         mockHandler(tagged).all({
            db: makeConnection(makeDb([]), pipeline),
            params: { userId: "u1" },
         }),
      ).rejects.toThrow("denied");

      // init() incremented, end() decremented — back to 0
      const m = limiter.metrics.get(tagged.id);
      expect(m?.inFlight).toBe(0);
      expect(m?.totalCalls).toBe(1);
   });

   test("end() decrements inFlight even when check() rejects", async () => {
      const pipeline = new SqlQueryPipeline<{ Context: { userId: string } }>();
      const limiter = new TimeToLiveRateLimiter<{ userId: string }>({
         name: "limiter",
         maxConcurrent: 0, // reject everything
      });
      pipeline.use(limiter);

      await expect(
         mockHandler(findAccountsByOwner).all({
            db: makeConnection(makeDb([]), pipeline),
            params: { userId: "u1" },
         }),
      ).rejects.toThrow("concurrency limit");

      // init() incremented to 1, check rejects (1 > 0), end() decrements back to 0
      const m = limiter.metrics.get(findAccountsByOwner.id);
      expect(m?.inFlight).toBe(0);
      expect(m?.totalCalls).toBe(1);
   });

   test("init and end always pair — inFlight never goes negative on repeated rejections", async () => {
      const pipeline = new SqlQueryPipeline<{ Context: { userId: string } }>();
      const limiter = new TimeToLiveRateLimiter<{ userId: string }>({
         name: "limiter",
         maxConcurrent: 0,
      });
      pipeline.use(limiter);

      for (let i = 0; i < 5; i++) {
         await expect(
            mockHandler(findAccountsByOwner).all({
               db: makeConnection(makeDb([]), pipeline),
               params: { userId: "u1" },
            }),
         ).rejects.toThrow();
      }

      const m = limiter.metrics.get(findAccountsByOwner.id);
      expect(m?.inFlight).toBe(0);
      expect(m?.totalCalls).toBe(5);
   });
});

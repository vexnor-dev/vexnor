import "../../../test/mock-query-handler.js";
import { describe, expect, test, vi } from "vitest";
import { sql } from "#src/core/sql.js";
import { row } from "#src/core/query/sql-select-row.js";
import { Account } from "@test-models/vexnor_dev.account-table.js";
import { SqlQueryPipeline } from "#src/execution/sql-query-pipeline.js";
import { AuditLogPlugin } from "#src/execution/audit-log-plugin.js";
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

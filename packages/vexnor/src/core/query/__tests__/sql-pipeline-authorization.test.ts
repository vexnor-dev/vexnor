import "../../../test/mock-query-handler.js";
import { describe, expect, test, vi } from "vitest";
import { sql } from "#/core/sql.js";
import { row } from "#/core/query/sql-select-row.js";
import { Account } from "@test-models/vexnor_dev.account-table.js";
import { SqlQueryPipeline } from "#/execution/sql-query-pipeline.js";
import { connect } from "#/plugin/vexnor-connection.js";
import { MockConnection } from "#/test/mock-plugin.js";
import { mockHandler } from "#/test/mock-query-handler.js";
import { ctx } from "#/core/query/sql-param.js";

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
      ).rejects.toThrow("Authorization denied");

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
         `[SqlRunError: Query "SqlQuery#1" requires authorization (tags: ["admin"]) but no authorize hook is registered]`,
      );
   });

   test("tagged query against raw db with no pipeline executes without authorization check", async () => {
      const db = makeDb([mockAccount]);

      const result = await mockHandler(taggedQuery).all({
         db,
         params: { userId: "u1" },
      });

      expect(result).toEqual([mockAccount]);
      expect(db.query).toHaveBeenCalledOnce();
   });

   test("authorization hook is called for query with multiple tags", async () => {
      const multiTagged = findAccountsByOwner.authorize("admin", "audit");
      const pipeline = new SqlQueryPipeline<{ Context: { userId: string } }>();
      const hook = vi.fn();
      pipeline.registerAuthorization(hook);

      await mockHandler(multiTagged).all({
         db: makeConnection(makeDb([mockAccount]), pipeline),
         params: { userId: "u1" },
      });

      expect(hook).toHaveBeenCalledOnce();
      expect(hook).toHaveBeenCalledWith(expect.objectContaining({ query: expect.objectContaining({ authorization: ["admin", "audit"] }) }));
   });

   test("authorization hook is triggered when subquery carries a tag but parent does not", async () => {
      const inner = sql`SELECT ${row(Account.$accountId)} FROM ${Account} WHERE ${Account.$accountId} = ${ctx<{ userId: string }>("userId")}`.authorize("user");
      const outer = sql`SELECT * FROM (${inner})`;
      const pipeline = new SqlQueryPipeline<{ Context: { userId: string } }>();
      const hook = vi.fn();
      pipeline.registerAuthorization(hook);

      await mockHandler(outer).all({
         db: makeConnection(makeDb([mockAccount]), pipeline),
         params: { userId: "u1" },
      });

      expect(hook).toHaveBeenCalledOnce();
      expect(hook).toHaveBeenCalledWith(expect.objectContaining({ query: expect.objectContaining({ authorization: ["user"] }) }));
   });

   test("authorization merges parent and subquery tags for hook", async () => {
      const inner = sql`SELECT ${row(Account.$accountId)} FROM ${Account} WHERE ${Account.$accountId} = ${ctx<{ userId: string }>("userId")}`.authorize("user");
      const outer = sql`SELECT * FROM (${inner})`.authorize("admin");
      const pipeline = new SqlQueryPipeline<{ Context: { userId: string } }>();
      const hook = vi.fn();
      pipeline.registerAuthorization(hook);

      await mockHandler(outer).all({
         db: makeConnection(makeDb([mockAccount]), pipeline),
         params: { userId: "u1" },
      });

      expect(hook).toHaveBeenCalledOnce();
      expect(hook).toHaveBeenCalledWith(expect.objectContaining({ query: expect.objectContaining({ authorization: ["admin", "user"] }) }));
   });
});

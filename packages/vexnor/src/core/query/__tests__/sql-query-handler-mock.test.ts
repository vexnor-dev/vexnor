import { describe, expect, test, vi } from "vitest";
import { sql } from "#/core/sql.js";
import { row } from "#/core/query/sql-select-row.js";
import { ctx, param } from "#/core/query/sql-param.js";
import { SqlRunError } from "#/core/sql-run-error.js";
import { Account } from "@test-models/vexnor_dev.account-table.js";
import { SqlQueryPipeline } from "#/execution/sql-query-pipeline.js";
import { connect } from "#/plugin/vexnor-connection.js";
import { ok } from "node:assert";
import { MockConnection } from "#/test/mock-plugin.js";
import { mockHandler } from "#/test/mock-query-handler.js";

type MockAccount = { accountId: string; email: string; firstName: string };

const mockAccount: MockAccount = { accountId: "1", email: "test@example.com", firstName: "Test" };

const findAccounts = sql`
    select ${row(Account.$accountId, Account.$email, Account.$firstName)}
    from ${Account}
    where ${Account.$email} = ${param<{ email: string }>("email")}
`;

const findAccountsSinceAt = sql`
    select ${row(Account.$accountId, Account.$email, Account.$firstName)}
    from ${Account}
    where ${Account.$email} = ${param<{ email: string }>("email")} and ${Account.$createdAt} > ${ctx<{ sinceAt: Date }>("sinceAt")}
`;

describe("SqlQueryHandler mock execution", () => {
   test("all() returns resolved rows", async () => {
      const db: MockConnection = {
         query: async () => {
            return { rows: [mockAccount, mockAccount] };
         },
      } as MockConnection;
      const result = await mockHandler(findAccounts).all({ db, params: { email: "test@example.com" } });
      expect(result).toMatchInlineSnapshot(`
        [
          {
            "accountId": "1",
            "email": "test@example.com",
            "firstName": "Test",
          },
          {
            "accountId": "1",
            "email": "test@example.com",
            "firstName": "Test",
          },
        ]
      `);
   });

   test("one() returns single row", async () => {
      const db: MockConnection = { query: async () => ({ rows: [mockAccount] }) } as MockConnection;
      const result = await mockHandler(findAccounts).one({ db, params: { email: "test@example.com" } });
      expect(result).toMatchInlineSnapshot(`
        {
          "accountId": "1",
          "email": "test@example.com",
          "firstName": "Test",
        }
      `);
   });

   test("one() throws when no rows", async () => {
      const db: MockConnection = { query: async () => ({ rows: [] }) } as MockConnection;
      await expect(mockHandler(findAccounts).one({ db, params: { email: "test@example.com" } })).rejects.toThrow(
         "Expected one row",
      );
   });

   test("one() throws when more than one row", async () => {
      const db: MockConnection = { query: async () => ({ rows: [mockAccount, mockAccount] }) } as MockConnection;
      await expect(mockHandler(findAccounts).one({ db, params: { email: "test@example.com" } })).rejects.toThrow(
         "Expected one row",
      );
   });

   test("any() returns first row or undefined", async () => {
      const db: MockConnection = { query: async () => ({ rows: [mockAccount] }) } as MockConnection;
      const result = await mockHandler(findAccounts).any({ db, params: { email: "test@example.com" } });
      expect(result).toMatchInlineSnapshot(`
        {
          "accountId": "1",
          "email": "test@example.com",
          "firstName": "Test",
        }
      `);
   });

   test("any() returns undefined when no rows", async () => {
      const db: MockConnection = { query: async () => ({ rows: [] }) } as MockConnection;
      const result = await mockHandler(findAccounts).any({ db, params: { email: "test@example.com" } });
      expect(result).toBeUndefined();
   });

   test("run() calls db with correct sql and values", async () => {
      const query = vi.fn(async () => ({ rows: [mockAccount] }));
      const db: MockConnection = { query } as MockConnection;
      await mockHandler(findAccounts).run({ db, params: { email: "test@example.com" } });
      expect(query).toHaveBeenCalledOnce();
      expect(query).toHaveBeenCalledWith(
         expect.stringMatching(/select.*account_id.*email.*first_name.*from.*account.*where.*email/is),
         ["test@example.com"],
      );
   });

   test("db can be a Promise", async () => {
      const db = Promise.resolve<MockConnection>({ query: async () => ({ rows: [mockAccount] }) } as MockConnection);
      const result = await mockHandler(findAccounts).all({ db, params: { email: "test@example.com" } });
      expect(result).toHaveLength(1);
   });

   test("VexnorConnection with pipeline fires before and after around local execution", async () => {
      const query = vi.fn(async () => ({ rows: [mockAccount] }));
      const db: MockConnection = { query, name: "my test connection" } as MockConnection;
      const pipeline = new SqlQueryPipeline<{ Context: { sinceAt: Date } }>();
      const before = vi.fn();
      const after = vi.fn();

      pipeline.use({ name: "observer", before, after });

      const connection = connect(db, { pipeline });

      const handler = mockHandler(findAccountsSinceAt);
      const result = await handler.all({
         db: connection,
         params: { email: "test@example.com", sinceAt: new Date() },
      });
      await Promise.resolve();

      expect(result).toEqual([mockAccount]);
      expect(query).toHaveBeenCalledOnce();
      expect(before).toHaveBeenCalledWith(
         expect.objectContaining({
            plugin: { name: "mock" },
            name: expect.any(String),
            query: handler,
            params: { email: "test@example.com", sinceAt: expect.any(Date) },
            context: { sinceAt: expect.any(Date) },
         }),
      );
      expect(after).toHaveBeenCalledWith(
         expect.objectContaining({
            error: null,
            durationMs: expect.any(Number),
         }),
      );
   });

   test("VexnorConnection without pipeline unwraps and executes locally", async () => {
      const query = vi.fn(async () => ({ rows: [mockAccount] }));
      const db: MockConnection = { query } as MockConnection;
      const connection = connect<{ email: string }, MockConnection>(db);

      const result = await mockHandler(findAccounts).all({
         db: connection,
         params: { email: "test@example.com" },
      });

      expect(result).toEqual([mockAccount]);
      expect(query).toHaveBeenCalledOnce();
   });

   test("pipeline context must be a subset of query params — extra keys are a type error", async () => {
      const db: MockConnection = { query: vi.fn(async () => ({ rows: [mockAccount] })) } as MockConnection;
      const pipeline = new SqlQueryPipeline<{ Context: { sinceAt: Date; unknownKey: string } }>();
      const connection = connect(db, { pipeline });
      const handler = mockHandler(findAccountsSinceAt);

      await handler.all({
         // @ts-expect-error — unknownKey is not in findAccountsSinceAt params { email: string; sinceAt: Date }
         db: connection,
         params: { email: "test@example.com", sinceAt: new Date() },
      });
   });

   test("all() wraps error in SqlRunError with queryLocation as queryName fallback", async () => {
      const queryInTest = sql`
         select ${row(Account.$accountId)} from ${Account}
         where ${Account.$email} = ${param<{ email: string }>("email")}
      `;
      const db: MockConnection = {
         query: async () => {
            throw new Error("db failure");
         },
      };

      try {
         await mockHandler(queryInTest).all({ db, params: { email: "x" } });
      } catch (err) {
         expect(err).toBeInstanceOf(SqlRunError);
         ok(err instanceof SqlRunError);
         expect(err.queryName).toBe(err.queryLocation);
      }
   });

   test("all() uses info label as queryName when set", async () => {
      const { info } = await import("#/core/charms/sql-query-info.js");
      const labelledQuery = sql`
         ${info({ label: "myQuery" })}
         select ${row(Account.$accountId)} from ${Account}
         where ${Account.$email} = ${param<{ email: string }>("email")}
      `;
      const db: MockConnection = {
         query: async () => {
            throw new Error("db failure");
         },
      };

      try {
         await mockHandler(labelledQuery).all({ db, params: { email: "x" } });
         expect.fail("Should have thrown");
      } catch (err) {
         expect(err).toBeInstanceOf(SqlRunError);
         ok(err instanceof SqlRunError);
         expect(err.queryName).toBe("myQuery");
      }
   });
});

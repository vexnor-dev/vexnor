import { describe, expect, test, vi, beforeEach } from "vitest";
import { sql } from "#/core/sql.js";
import { row } from "#/core/query/sql-select-row.js";
import { param } from "#/core/query/sql-param.js";
import { SqlQueryHandler, newSqlQueryHandler } from "#/core/query/sql-query-handler.js";
import { SqlQuery } from "#/core/query/sql-query.js";
import { SqlRunArgs } from "#/core/query/sql-query-types.js";
import { Account } from "@test-models/vexnor_dev.account-table.js";
import { resetIds } from "#/core/sql-base.js";

type MockResult = { rows: unknown[] };
type MockConnection = { query: (sql: string, params: unknown[]) => Promise<MockResult> };

class MockQueryHandler<T extends { Row?: unknown; Params?: unknown }> extends SqlQueryHandler<
   Pick<T, "Row" | "Params"> & {
      QueryResult: MockResult;
      Connection: MockConnection;
   }
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

function mockHandler<T extends { Row?: unknown; Params?: unknown }>(query: SqlQuery<T>) {
   // eslint-disable-next-line @typescript-eslint/no-explicit-any
   return newSqlQueryHandler(new MockQueryHandler<T>(query as any) as any);
}

const findAccounts = sql`
   select ${row(Account.$accountId, Account.$email, Account.$firstName)}
   from ${Account}
   where ${Account.$email} = ${param<{ email: string }>("email")}
`;

const mockAccount = { accountId: "1", email: "test@example.com", firstName: "Test" };

beforeEach(() => resetIds());

describe("SqlQueryHandler mock execution", () => {
   test("all() returns resolved rows", async () => {
      const db: MockConnection = { query: async () => ({ rows: [mockAccount, mockAccount] }) };
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
      const db: MockConnection = { query: async () => ({ rows: [mockAccount] }) };
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
      const db: MockConnection = { query: async () => ({ rows: [] }) };
      await expect(mockHandler(findAccounts).one({ db, params: { email: "test@example.com" } })).rejects.toThrow(
         "Expected one row",
      );
   });

   test("one() throws when more than one row", async () => {
      const db: MockConnection = { query: async () => ({ rows: [mockAccount, mockAccount] }) };
      await expect(mockHandler(findAccounts).one({ db, params: { email: "test@example.com" } })).rejects.toThrow(
         "Expected one row",
      );
   });

   test("any() returns first row or undefined", async () => {
      const db: MockConnection = { query: async () => ({ rows: [mockAccount] }) };
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
      const db: MockConnection = { query: async () => ({ rows: [] }) };
      const result = await mockHandler(findAccounts).any({ db, params: { email: "test@example.com" } });
      expect(result).toBeUndefined();
   });

   test("run() calls db with correct sql and values", async () => {
      const query = vi.fn(async () => ({ rows: [mockAccount] }));
      const db: MockConnection = { query };
      await mockHandler(findAccounts).run({ db, params: { email: "test@example.com" } });
      expect(query).toHaveBeenCalledOnce();
      expect(query).toHaveBeenCalledWith(
         expect.stringMatching(/select.*account_id.*email.*first_name.*from.*account.*where.*email/is),
         ["test@example.com"],
      );
   });

   test("db can be a Promise", async () => {
      const db = Promise.resolve<MockConnection>({ query: async () => ({ rows: [mockAccount] }) });
      const result = await mockHandler(findAccounts).all({ db, params: { email: "test@example.com" } });
      expect(result).toHaveLength(1);
   });
});

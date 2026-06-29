import { describe, expect, test } from "vitest";
import { sql } from "#src/core/sql.js";
import { row } from "#src/core/query/sql-select-row.js";
import { Account } from "@test-models/vexnor_dev.account-table.js";
import { mockHandler } from "#src/test/mock-query-handler.js";
import { MockConnection } from "#src/test/mock-plugin.js";
import { SqlBuildContext } from "#src/core/builder/sql-build-context.js";

type MockAccount = { accountId: string; email: string };

const mockAccount: MockAccount = { accountId: "1", email: "test@example.com" };

const findAccounts = sql`
   select ${row(Account.$accountId, Account.$email)}
   from ${Account}
`;

describe("SqlQueryHandler.first()", () => {
   test("returns first row when rows exist", async () => {
      const db: MockConnection = { query: async () => ({ rows: [mockAccount, { ...mockAccount, accountId: "2" }] }) } as MockConnection;
      const result = await mockHandler(findAccounts).first({ db });
      expect(result).toMatchInlineSnapshot(`
        {
          "accountId": "1",
          "email": "test@example.com",
        }
      `);
   });

   test("returns undefined when no rows", async () => {
      const db: MockConnection = { query: async () => ({ rows: [] }) } as MockConnection;
      const result = await mockHandler(findAccounts).first({ db });
      expect(result).toBeUndefined();
   });
});

describe("SqlQueryHandler.write()", () => {
   test("delegates to source.write and builds correct SQL", () => {
      const handler = mockHandler(findAccounts);
      const ctx = new SqlBuildContext({});
      handler.write(ctx);
      expect(ctx.text).toMatchInlineSnapshot(`
        "/* <query_0> */
        SELECT
          "a_1"."account_id" AS "accountId",
          "a_1"."email"
        FROM
          "main"."account" AS "a_1"
          /* </query_0> */"
      `);
   });
});

import { contextValue } from "#/core/query/context-value.js";
import { row } from "#/core/query/sql-select-row.js";
import { Account } from "@test-models/vexnor_dev.account-table.js";
import { sql } from "#/test/mock-sql.js";
import { defineQueryConfig } from "#/config/define-query-config.js";
import { MockPlugin, type MockConnection } from "#/test/mock-plugin.js";
import { vi } from "vitest";
import { ctx } from "#/core/query/sql-param.js";

const mockDb: MockConnection = { query: vi.fn().mockResolvedValue({ rows: [] }) };
export const testPlugin = new MockPlugin({ name: "test" }, mockDb);

export const selectMyOrders = sql`
   SELECT ${row(Account.$accountId)}
   FROM ${Account}
   WHERE ${Account.$accountId} = ${ctx<{ userId: string }>("userId")}
`;

export default defineQueryConfig({ selectMyOrders })({
   queries: {
      selectMyOrders: {
         profile: "testdb",
         plugin: testPlugin,
         params: { userId: contextValue },
      },
   },
});

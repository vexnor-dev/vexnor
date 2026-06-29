import { contextValue } from "#src/core/query/context-value.js";
import { row } from "#src/core/query/sql-select-row.js";
import { Account } from "@test-models/vexnor_dev.account-table.js";
import { sql } from "#src/test/mock-sql.js";
import { defineQueryConfig } from "#src/config/define-query-config.js";
import { MockPlugin, type MockConnection } from "#src/test/mock-plugin.js";
import { vi } from "vitest";
import { ctx } from "#src/core/query/sql-param.js";

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

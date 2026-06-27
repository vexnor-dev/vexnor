import { MockPlugin, type MockConnection } from "#src/test/mock-plugin.js";
import { defineQueryConfig } from "#src/config/define-query-config.js";
import { sql } from "#src/test/mock-sql.js";
import { param } from "#src/core/query/sql-param.js";
import { vi } from "vitest";

const mockDb: MockConnection = { query: vi.fn().mockResolvedValue({ rows: [] }) };
export const testPlugin = new MockPlugin({ name: "test" }, mockDb);

const envQuery = sql`SELECT * FROM accounts WHERE name = ${param<{ name: string }>("name")}`;

export default defineQueryConfig({ envQuery })({
   queries: {
      envQuery: {
         profile: "testdb",
         plugin: testPlugin,
         params: { name: "default-value" },
         environments: {
            staging: { name: "staging-value" },
            production: { name: "prod-value" },
         },
      },
   },
});

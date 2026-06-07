import { MockPlugin, type MockConnection } from "#/test/mock-plugin.js";
import { defineQueryConfig } from "#/config/define-query-config.js";
import { sql } from "#/test/mock-sql.js";
import { vi } from "vitest";

const mockDb: MockConnection = { query: vi.fn().mockResolvedValue({ rows: [] }) };
export const testPlugin = new MockPlugin({ name: "test" }, mockDb);

const insertQuery = sql`INSERT INTO accounts (name) VALUES ('test')`;
const deleteQuery = sql`DELETE FROM accounts WHERE id = 1`;
const dropQuery = sql`DROP TABLE accounts`;

export default defineQueryConfig({ insertQuery, deleteQuery, dropQuery })({
   queries: {
      insertQuery: {
         profile: "testdb",
         plugin: testPlugin,
         params: {},
      },
      deleteQuery: {
         profile: "testdb",
         plugin: testPlugin,
         params: {},
      },
      dropQuery: {
         profile: "testdb",
         plugin: testPlugin,
         params: {},
      },
   },
});

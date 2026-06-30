// noinspection SqlNoDataSourceInspection,SqlResolve
import { MockPlugin, type MockConnection } from "#src/test/mock-plugin.js";
import { defineQueryConfig } from "#src/config/define-query-config.js";
import { sql } from "#src/test/mock-sql.js";
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
         params: void 0,
      },
      deleteQuery: {
         profile: "testdb",
         plugin: testPlugin,
         params: void 0,
      },
      dropQuery: {
         profile: "testdb",
         plugin: testPlugin,
         params: void 0,
      },
   },
});

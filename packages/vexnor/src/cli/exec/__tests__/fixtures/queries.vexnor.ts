import { defineQueryConfig } from "../../../../config/config.js";
import { findAccountById } from "#/config/__tests__/test-queries.js";
import { MockPlugin, type MockConnection } from "#/test/mock-plugin.js";
import { vi } from "vitest";

const mockDb: MockConnection = { query: vi.fn().mockResolvedValue({ rows: [] }) };
export const testPlugin = new MockPlugin({ name: "mock" }, mockDb);
export { mockDb };

export default defineQueryConfig({ findAccountById })({
   queries: {
      findAccountById: {
         profile: "testdb",
         plugin: testPlugin,
         params: { accountId: "1", email: "test@example.com" },
      },
   },
});

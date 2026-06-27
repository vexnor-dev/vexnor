import { defineQueryConfig } from "../../define-query-config.js";
import { findAccountById } from "../test-queries.js";
import { MockConnection, MockPlugin } from "#src/test/mock-plugin.js";
import { vi } from "vitest";
const mockDb: MockConnection = {
   query: vi.fn().mockResolvedValue({ rows: [] }),
};

const testPlugin = new MockPlugin({ name: "test-plugin" }, mockDb);

export default defineQueryConfig({ findAccountById })({
   queries: {
      findAccountById: {
         profile: "postgres",
         plugin: testPlugin,
         params: { accountId: "1", email: "test@example.com" },
      },
   },
});

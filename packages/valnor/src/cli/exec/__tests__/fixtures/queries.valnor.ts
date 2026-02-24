import { defineQueryConfig } from "../../../../config/index.js";
import { findAccountById } from "../../../../config/__tests__/test-queries.js";
import testPlugin from "../test-plugin.js";

export default defineQueryConfig({ findAccountById })({
   queries: {
      findAccountById: {
         profile: "testdb",
         plugin: testPlugin,
         params: { accountId: "1", email: "test@example.com" },
      },
   },
});

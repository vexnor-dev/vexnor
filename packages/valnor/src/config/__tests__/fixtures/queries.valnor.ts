import { defineQueryConfig } from "../../define-query-config.js";
import { findAccountById } from "../test-queries.js";
import testPlugin from "../../../cli/exec/__tests__/test-plugin.js";

export default defineQueryConfig({ findAccountById })({
   queries: {
      findAccountById: {
         profile: "postgres",
         plugin: testPlugin,
         params: { accountId: 1, email: "test@example.com" },
      },
   },
});

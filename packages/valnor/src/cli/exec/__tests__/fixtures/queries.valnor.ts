import { defineQueryConfig } from "../../../../config/index.js";
import { findAccountById } from "../../../../config/__tests__/test-queries.js";

export default defineQueryConfig({ findAccountById })({
   queries: {
      findAccountById: {
         profile: "testdb",
         params: { accountId: 1, email: "test@example.com" },
      },
   },
});

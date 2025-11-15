import { defineQueryConfig } from "../../define-query-config.js";
import { findAccountById } from "../test-queries.js";

export default defineQueryConfig({ findAccountById })({
   queries: {
      findAccountById: {
         profile: "postgres",
         params: { accountId: 1, email: "test@example.com" },
      },
   },
});

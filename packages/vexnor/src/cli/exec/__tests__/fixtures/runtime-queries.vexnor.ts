import { defineQueryConfig } from "../../../../config/config.js";
import { runtimeValue } from "#/core/query/runtime-value.js";
import testPlugin from "../test-plugin.js";
import { sql } from "../test-driver-setup.js";
import { runtime } from "#/core/query/sql-runtime.js";
import { row } from "#/core/query/sql-select-row.js";
import { Account } from "@test-models/vexnor_dev.account-table.js";

export const selectMyOrders = sql`
   SELECT ${row(Account.$accountId)}
   FROM ${Account}
   WHERE ${Account.$accountId} = ${runtime<{ userId: string }>("userId")}
`;

export default defineQueryConfig({ selectMyOrders })({
   queries: {
      selectMyOrders: {
         profile: "testdb",
         plugin: testPlugin,
         params: { userId: runtimeValue },
      },
   },
});

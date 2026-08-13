import "@vexnor/duckdb";
import { contextValue } from "@vexnor/core";
import { defineQueryConfig } from "@vexnor/core/config";
import duckdbPlugin from "@vexnor/duckdb";
import { deleteAccount, insertAccount, selectAccounts, selectAccountsForLogin, selectMyOrders } from "./duckdb.js";

export default defineQueryConfig({
   selectAccounts,
   selectAccountsForLogin,
   selectMyOrders,
   deleteAccount,
   insertAccount,
})({
   queries: {
      selectAccounts: {
         profile: "duckdb",
         plugin: duckdbPlugin,
         params: { filter: "test" },
      },
      selectAccountsForLogin: {
         profile: "duckdb",
         plugin: duckdbPlugin,
         params: {},
      },
      selectMyOrders: {
         profile: "duckdb",
         plugin: duckdbPlugin,
         params: { userId: contextValue },
      },
      deleteAccount: {
         profile: "duckdb",
         plugin: duckdbPlugin,
         params: { accountId: "00000000-0000-0000-0000-000000000000" },
      },
      insertAccount: {
         profile: "duckdb",
         plugin: duckdbPlugin,
         params: { rows: [{ email: "test@example.com", firstName: "Test", lastName: "User" }] },
      },
   },
});

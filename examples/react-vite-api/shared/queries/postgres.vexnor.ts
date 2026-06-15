import "@vexnor/postgres";
import { defineQueryConfig } from "vexnor/config";
import { contextValue } from "vexnor";
import postgresPlugin from "@vexnor/postgres";
import { selectAccounts, selectAccountsForLogin, selectMyOrders, deleteAccount, insertAccount } from "./postgres.js";

export default defineQueryConfig({
   selectAccounts,
   selectAccountsForLogin,
   selectMyOrders,
   deleteAccount,
   insertAccount,
})({
   queries: {
      selectAccounts: {
         profile: "postgres",
         plugin: postgresPlugin,
         params: { filter: undefined },
         environments: {
            filtered: { filter: "alice" },
         },
      },
      selectAccountsForLogin: {
         profile: "postgres",
         plugin: postgresPlugin,
         params: void 0,
      },
      selectMyOrders: {
         profile: "postgres",
         plugin: postgresPlugin,
         params: { userId: contextValue },
      },
      deleteAccount: {
         profile: "postgres",
         plugin: postgresPlugin,
         params: { accountId: "00000000-0000-0000-0000-000000000000" },
      },
      insertAccount: {
         profile: "postgres",
         plugin: postgresPlugin,
         params: { rows: [{ email: "test@example.com", firstName: "Test", lastName: "User" }] },
      },
   },
});

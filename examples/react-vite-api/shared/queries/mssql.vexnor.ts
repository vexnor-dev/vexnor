import "vexnor-mssql";
import { defineQueryConfig } from "vexnor/config";
import { contextValue } from "vexnor";
import mssqlPlugin from "vexnor-mssql";
import { selectAccounts, selectAccountsForLogin, selectMyOrders, deleteAccount, insertAccount } from "./mssql.js";

export default defineQueryConfig({
   selectAccounts,
   selectAccountsForLogin,
   selectMyOrders,
   deleteAccount,
   insertAccount,
})({
   queries: {
      selectAccounts: {
         profile: "mssql",
         plugin: mssqlPlugin,
         params: { filter: "test" },
         environments: {
            filtered: { filter: "alice" },
         },
      },
      selectAccountsForLogin: {
         profile: "mssql",
         plugin: mssqlPlugin,
         params: void 0,
      },
      selectMyOrders: {
         profile: "mssql",
         plugin: mssqlPlugin,
         params: { userId: contextValue },
      },
      deleteAccount: {
         profile: "mssql",
         plugin: mssqlPlugin,
         params: { accountId: "00000000-0000-0000-0000-000000000000" },
      },
      insertAccount: {
         profile: "mssql",
         plugin: mssqlPlugin,
         params: { rows: [{ email: "test@example.com", firstName: "Test", lastName: "User" }] },
      },
   },
});

import "@vexnor/sqlite3";
import { defineQueryConfig } from "vexnor/config";
import { contextValue } from "vexnor";
import sqlite3Plugin from "@vexnor/sqlite3";
import { selectAccounts, selectAccountsForLogin, selectMyOrders, deleteAccount, insertAccount } from "./sqlite3.js";

export default defineQueryConfig({
   selectAccounts,
   selectAccountsForLogin,
   selectMyOrders,
   deleteAccount,
   insertAccount,
})({
   queries: {
      selectAccounts: {
         profile: "sqlite3",
         plugin: sqlite3Plugin,
         params: { filter: "test" },
         environments: {
            filtered: { filter: "alice" },
         },
      },
      selectAccountsForLogin: {
         profile: "sqlite3",
         plugin: sqlite3Plugin,
         params: void 0,
      },
      selectMyOrders: {
         profile: "sqlite3",
         plugin: sqlite3Plugin,
         params: { userId: contextValue },
      },
      deleteAccount: {
         profile: "sqlite3",
         plugin: sqlite3Plugin,
         params: { accountId: "00000000-0000-0000-0000-000000000000" },
      },
      insertAccount: {
         profile: "sqlite3",
         plugin: sqlite3Plugin,
         params: { rows: [{ email: "test@example.com", firstName: "Test", lastName: "User" }] },
      },
   },
});

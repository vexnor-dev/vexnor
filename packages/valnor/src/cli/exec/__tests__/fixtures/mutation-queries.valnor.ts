import { defineQueryConfig } from "../../../../config/index.js";
// @ts-ignore
import { sql } from "/Users/adrian/Work/valnor-root/packages/valnor/src/cli/exec/__tests__/test-driver-setup.ts";

const insertQuery = sql`INSERT INTO accounts (name) VALUES ('test')`;
const deleteQuery = sql`DELETE FROM accounts WHERE id = 1`;
const dropQuery = sql`DROP TABLE accounts`;

export default defineQueryConfig({ insertQuery, deleteQuery, dropQuery })({
   queries: {
      insertQuery: {
         profile: "testdb",
         params: {},
      },
      deleteQuery: {
         profile: "testdb",
         params: {},
      },
      dropQuery: {
         profile: "testdb",
         params: {},
      },
   },
});

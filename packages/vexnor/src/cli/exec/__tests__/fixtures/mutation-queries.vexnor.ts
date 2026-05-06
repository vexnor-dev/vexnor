import { defineQueryConfig } from "../../../../config/config.js";

import testPlugin from "../test-plugin.js";
import { sql } from "../test-driver-setup.js";

const insertQuery = sql`INSERT INTO accounts (name) VALUES ('test')`;
const deleteQuery = sql`DELETE FROM accounts WHERE id = 1`;
const dropQuery = sql`DROP TABLE accounts`;

export default defineQueryConfig({ insertQuery, deleteQuery, dropQuery })({
   queries: {
      insertQuery: {
         profile: "testdb",
         plugin: testPlugin,
         params: {},
      },
      deleteQuery: {
         profile: "testdb",
         plugin: testPlugin,
         params: {},
      },
      dropQuery: {
         profile: "testdb",
         plugin: testPlugin,
         params: {},
      },
   },
});

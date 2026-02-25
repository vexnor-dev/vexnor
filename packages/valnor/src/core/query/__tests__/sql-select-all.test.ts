import { describe, expect, test } from "vitest";
import { SqlSelectAll } from "../sql-select-all.js";
import { newSqlSelectColumn } from "../sql-query-column.js";
import { newSqlTableColumn } from "../../schema/index.js";
import { sql } from "../../sql.js";

describe("SqlSelectAll tests", () => {
   const tableInfo = { name: "account", schema: "valnor_test" };
   test("new value should be defined", () => {
      const query = sql``;
      const all = new SqlSelectAll<{ accountId: string; name: string }>({
         query,
         row: {
            $accountId: newSqlSelectColumn<{ Key: "accountId"; Type: string }>({
               query,
               key: "accountId",
               target: newSqlTableColumn<{ Key: "accountId"; Type: string }>({
                  key: "accountId",
                  columnName: "account_id",
                  tableInfo,
               }),
            }),
            $name: newSqlSelectColumn<{ Key: "name"; Type: string }>({
               query,
               key: "name",
               target: newSqlTableColumn<{ Key: "name"; Type: string }>({ key: "name", columnName: "name", tableInfo }),
            }),
         },
      });
      expect(all).toBeDefined();
   });
});

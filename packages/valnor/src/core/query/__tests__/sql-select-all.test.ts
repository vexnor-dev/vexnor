import { describe, expect, test } from "vitest";
import { SqlSelectAll } from "../sql-select-all.js";
import { newSqlSelectColumn } from "../sql-select-column.js";

describe("SqlSelectAll tests", () => {
   test("new value should be defined", () => {
      const all = new SqlSelectAll<{ accountId: string; name: string }>({
         $accountId: newSqlSelectColumn<{ Key: "accountId"; Type: string }>({
            key: "accountId",
            columnName: "account_id",
         }),
         $name: newSqlSelectColumn<{ Key: "name"; Type: string }>({
            key: "name",
            columnName: "name",
         }),
      });
      expect(all).toBeDefined();
   });
});

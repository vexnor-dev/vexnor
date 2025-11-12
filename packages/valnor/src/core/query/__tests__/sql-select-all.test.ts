import { describe, expect, test } from "vitest";
import { SqlSelectAll } from "../sql-select-all.js";
import { SqlSelectColumn } from "../sql-select-column.js";

describe("SqlSelectAll tests", () => {
   test("new value should be defined", () => {
      const all = new SqlSelectAll<{ Row: { accountId: string; name: string } }>({
         accountId: new SqlSelectColumn<{ Key: "accountId"; Type: string }>({
            key: "accountId",
            columnName: "account_id",
         }),
         name: new SqlSelectColumn<{ Key: "name"; Type: string }>({
            key: "name",
            columnName: "name",
         }),
      });
      expect(all).toBeDefined();
   });
});

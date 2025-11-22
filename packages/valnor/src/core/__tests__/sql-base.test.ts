import { describe, expect, test } from "vitest";
import { IAccountSelect } from "./models/valnor_test.account-table.js";
import { InferTable$RowBySelect } from "../types/index.js";
import { newSqlTableColumn } from "../schema/index.js";

describe("SqlBase tests", () => {
   test("InferSqlRowFromRecord", () => {
      const row: InferTable$RowBySelect<Pick<IAccountSelect, "accountId" | "modifiedAt">> = {
         $accountId: newSqlTableColumn<{ Key: "accountId"; Type: string }>({
            key: "accountId",
            columnName: "account_id",
            tableInfo: { name: "accounts" },
         }),
         $modifiedAt: newSqlTableColumn<{ Key: "modifiedAt"; Type: Date }>({
            key: "modifiedAt",
            columnName: "modified_at",
            tableInfo: { name: "accounts" },
         }),
      };
      expect(row).toBeDefined();
   });

   test("Inherit from Sql<{ Row: Record<string, unknown> }>", () => {
      type Select = Pick<IAccountSelect, "accountId" | "modifiedAt">;
      const cols: InferTable$RowBySelect<Select> = {
         $accountId: newSqlTableColumn<{ Key: "accountId"; Type: string }>({
            key: "accountId",
            columnName: "account_id",
            tableInfo: { name: "accounts" },
         }),
         $modifiedAt: newSqlTableColumn<{ Key: "modifiedAt"; Type: Date }>({
            key: "modifiedAt",
            columnName: "modified_at",
            tableInfo: { name: "accounts" },
         }),
      };
      const target: { row: InferTable$RowBySelect<Select> } = { row: cols };
      expect(target).toBeDefined();
   });
});

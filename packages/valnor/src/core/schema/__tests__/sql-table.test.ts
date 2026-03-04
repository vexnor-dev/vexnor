import { describe, expect, test } from "vitest";
import { SqlTable, SqlTableColumn } from "../../schema/index.js";
import { Account } from "@test-models/valnor_test.account-table.js";
import { Sql } from "../../sql-base.js";

describe("SqlTable tests", () => {
   test("SqlTable inherits SqlBase", () => {
      expect(Account).instanceof(SqlTable);
      expect(Account).instanceof(Sql);
   });

   test("SqlTable should include expected columns", () => {
      expect(Account.$accountId).toBeDefined();
      expect(Account.$status).toBeDefined();
      expect(Account.$email).toBeDefined();

      expect(Account.$accountId).instanceof(SqlTableColumn);
      expect(Account.$status).instanceof(SqlTableColumn);
      expect(Account.$email).instanceof(SqlTableColumn);
   });

   test("SqlTable alias should return new SqlTable instance", () => {
      const actual = Account.as`parent`;
      console.log(actual);
      expect(actual).toBeDefined();
      expect(actual.tableInfo).toEqual(
         expect.objectContaining({
            schema: "main",
            name: "account",
            alias: "parent",
         }),
      );
   });

   test("SqlTable alias should return new SqlColumn instance", () => {
      const actual = Account.as`parent`.$accountId;
      console.log(actual);
      expect(actual).toBeDefined();
      expect(actual.tableInfo).toEqual<typeof actual.tableInfo>({
         schema: "main",
         name: "account",
         alias: "parent",
      });
      expect(actual.columnName).toEqual("account_id");
      expect(actual.key).toEqual("accountId");
   });

   test("SqlTable alias should return new SqlTable instance with respective $$ columns", () => {
      const actual = Account.as`inserted`.$$;
      expect(actual).toBeDefined();
      expect(actual.row).toMatchObject({
         $accountId: {
            key: "accountId",
            columnName: "account_id",
            tableInfo: {
               schema: "main",
               name: "account",
               alias: "inserted",
            },
         },
         $status: {
            key: "status",
            columnName: "status",
            tableInfo: {
               schema: "main",
               name: "account",
               alias: "inserted",
            },
         },
         $firstName: {
            key: "firstName",
            columnName: "first_name",
            tableInfo: {
               schema: "main",
               name: "account",
               alias: "inserted",
            },
         },
         $lastName: {
            key: "lastName",
            columnName: "last_name",
            tableInfo: {
               schema: "main",
               name: "account",
               alias: "inserted",
            },
         },
         $email: {
            key: "email",
            columnName: "email",
            tableInfo: {
               schema: "main",
               name: "account",
               alias: "inserted",
            },
         },
         $createdAt: {
            key: "createdAt",
            columnName: "created_at",
            tableInfo: {
               schema: "main",
               name: "account",
               alias: "inserted",
            },
         },
         $modifiedAt: {
            key: "modifiedAt",
            columnName: "modified_at",
            tableInfo: {
               schema: "main",
               name: "account",
               alias: "inserted",
            },
         },
         $parentId: {
            key: "parentId",
            columnName: "parent_id",
            tableInfo: {
               schema: "main",
               name: "account",
               alias: "inserted",
            },
         },
      });
   });
});

import { describe, expect, test } from "vitest";
import { SqlTable, SqlTableColumn } from "vexnor";
import { fromPrismaModelTable, fromPrismaModelView } from "../from-prisma-model.js";
import { getDialectFromPrismaProvider } from "../dialect.js";
import * as PrismaGenerated from "#/tests/vexnor-test-sqlite3/prisma/generated/index.js";

describe("vexnor-prisma client", () => {
   type AccountSelect = PrismaGenerated.Account;
   type AccountInsert = Pick<
      PrismaGenerated.Prisma.AccountUncheckedCreateInput,
      "accountId" | "email" | "firstName" | "lastName"
   >;
   type AccountUpdate = Pick<
      PrismaGenerated.Prisma.AccountUncheckedUpdateInput,
      "accountId" | "email" | "firstName" | "lastName"
   >;

   test("provider to dialect mapping", () => {
      expect(getDialectFromPrismaProvider("postgresql")).toBe("postgresql");
      expect(getDialectFromPrismaProvider("sqlserver")).toBe("tsql");
      expect(getDialectFromPrismaProvider("sqlite")).toBe("sqlite");
   });

   test("fromPrismaModelTable returns SqlTable with expected columns", () => {
      const accountModel = PrismaGenerated.Prisma.dmmf.datamodel.models.find((model) => model.name === "Account");
      expect(accountModel).toBeDefined();
      const Account = fromPrismaModelTable<AccountSelect, AccountInsert, AccountUpdate>(accountModel!, {
         provider: "postgresql",
      });

      expect(Account).toBeInstanceOf(SqlTable);
      expect(Account.$accountId).toBeInstanceOf(SqlTableColumn);
      expect(Account.$email).toBeInstanceOf(SqlTableColumn);
      expect(Account.$accountId?.columnName).toBe("account_id");
   });

   test("fromPrismaModelTable/View accept PrismaModel directly", () => {
      const accountModel = PrismaGenerated.Prisma.dmmf.datamodel.models.find((model) => model.name === "Account");
      expect(accountModel).toBeDefined();
      const Table = fromPrismaModelTable<AccountSelect, AccountInsert, AccountUpdate>(accountModel!, { provider: "sqlite" });
      const View = fromPrismaModelView<AccountSelect>(accountModel!, { provider: "sqlite" });

      expect(Table).toBeInstanceOf(SqlTable);
      expect(View).toBeInstanceOf(SqlTable);
      expect(View.crud.insert).toBe(false);
   });
});

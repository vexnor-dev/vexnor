import { afterAll, beforeAll, describe, expect, test } from "vitest";
import { DataTypes, InferAttributes, InferCreationAttributes, Model, Sequelize } from "sequelize";
import { row, sql, SqlTable } from "vexnor";
import { fromSequelizeTable, fromSequelizeView } from "../index.js";

class AccountModel extends Model<InferAttributes<AccountModel>, InferCreationAttributes<AccountModel>> {
   declare accountId: string;
   declare email: string;
   declare firstName: string;
}

class AccountOrderSummaryViewModel extends Model<
   InferAttributes<AccountOrderSummaryViewModel>,
   InferCreationAttributes<AccountOrderSummaryViewModel>
> {
   declare accountId: string;
   declare email: string;
}

let sequelize: Sequelize;

beforeAll(async () => {
   sequelize = new Sequelize("sqlite::memory:", { logging: false });

   AccountModel.init(
      {
         accountId: { type: DataTypes.STRING, allowNull: false, primaryKey: true, field: "account_id" },
         email: { type: DataTypes.STRING, allowNull: false, field: "email" },
         firstName: { type: DataTypes.STRING, allowNull: false, field: "first_name" },
      },
      {
         sequelize,
         modelName: "AccountModel",
         tableName: "account",
      },
   );

   AccountOrderSummaryViewModel.init(
      {
         accountId: { type: DataTypes.STRING, allowNull: false, field: "account_id" },
         email: { type: DataTypes.STRING, allowNull: false, field: "email" },
      },
      {
         sequelize,
         modelName: "AccountOrderSummaryViewModel",
         tableName: "account_order_summary",
         timestamps: false,
      },
   );
});

afterAll(async () => {
   await sequelize.close();
});

describe("fromSequelizeTable", () => {
   test("returns SqlTable instance", () => {
      expect(fromSequelizeTable(AccountModel)).toBeInstanceOf(SqlTable);
   });

   test("table mapping includes columns and pk", () => {
      const Account = fromSequelizeTable(AccountModel);
      expect(Account.pk).toEqual(["accountId"]);
      expect(Account.tableInfo).toEqual({ name: "account", schema: null });
      expect(Account.$firstName.columnName).toBe("first_name");
   });

   test("emits SELECT sql", () => {
      const Account = fromSequelizeTable(AccountModel);
      expect(sql`SELECT ${row(Account.$$)} FROM ${Account}`.getSql({}).text).toContain('"account_id" AS "accountId"');
   });
});

describe("fromSequelizeView", () => {
   test("creates select-only mapping for view model", () => {
      const AccountOrderSummary = fromSequelizeView(AccountOrderSummaryViewModel);
      expect(AccountOrderSummary.pk).toEqual([]);
      expect(AccountOrderSummary.tableInfo).toEqual({ name: "account_order_summary", schema: null });
      expect(AccountOrderSummary.$accountId.columnName).toBe("account_id");
   });
});

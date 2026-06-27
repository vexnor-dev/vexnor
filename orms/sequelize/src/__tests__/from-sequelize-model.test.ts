import { afterAll, beforeAll, describe, expect, test } from "vitest";
import { DataTypes, InferAttributes, InferCreationAttributes, Model, Sequelize } from "sequelize";
import { row, sql, SqlTable } from "@vexnor/core";
import { fromSequelizeTable, fromSequelizeView } from "../index.js";

class AccountModel extends Model<InferAttributes<AccountModel>, InferCreationAttributes<AccountModel>> {
   declare accountId: string;
   declare status: string | null;
   declare email: string;
   declare firstName: string;
   declare lastName: string;
   declare notes: string | null;
   declare createdAt: Date | null;
   declare modifiedAt: Date | null;
   declare parentId: string | null;
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
         status: { type: DataTypes.STRING, allowNull: true, field: "status" },
         email: { type: DataTypes.STRING, allowNull: false, field: "email" },
         firstName: { type: DataTypes.STRING, allowNull: false, field: "first_name" },
         lastName: { type: DataTypes.STRING, allowNull: false, field: "last_name" },
         notes: { type: DataTypes.TEXT, allowNull: true, field: "notes" },
         createdAt: { type: DataTypes.DATE, allowNull: true, field: "created_at" },
         modifiedAt: { type: DataTypes.DATE, allowNull: true, field: "modified_at" },
         parentId: { type: DataTypes.STRING, allowNull: true, field: "parent_id" },
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
      expect(Account.$accountId.columnName).toBe("account_id");
      expect(Account.$firstName.columnName).toBe("first_name");
      expect(Account.$email.columnName).toBe("email");
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

describe("fromSequelizeTable — schema-qualified table", () => {
   test("resolves schema from model tableName object", () => {
      class SchemaModel extends Model<InferAttributes<SchemaModel>, InferCreationAttributes<SchemaModel>> {
         declare id: string;
      }

      SchemaModel.init(
         { id: { type: DataTypes.STRING, allowNull: false, primaryKey: true } },
         { sequelize, modelName: "SchemaModel", tableName: "items", schema: "myschema" },
      );

      const table = fromSequelizeTable(SchemaModel);
      expect(table.tableInfo.schema).toBe("myschema");
      expect(table.tableInfo.name).toBe("items");
   });

   test("schemaOverride takes precedence", () => {
      class OverrideModel extends Model<InferAttributes<OverrideModel>, InferCreationAttributes<OverrideModel>> {
         declare id: string;
      }

      OverrideModel.init(
         { id: { type: DataTypes.STRING, allowNull: false, primaryKey: true } },
         { sequelize, modelName: "OverrideModel", tableName: "items", schema: "original" },
      );

      const table = fromSequelizeTable(OverrideModel, "overridden");
      expect(table.tableInfo.schema).toBe("overridden");
   });
});

describe("getDialect", () => {
   test("maps sequelize dialects to vexnor dialects", async () => {
      const { getDialect } = await import("#src/dialect.js");
      expect(getDialect("postgres")).toBe("postgresql");
      expect(getDialect("mssql")).toBe("tsql");
      expect(getDialect("sqlite")).toBe("sqlite");
      expect(getDialect("mysql")).toBe("mysql");
      expect(getDialect("unknown")).toBe("sql");
   });
});

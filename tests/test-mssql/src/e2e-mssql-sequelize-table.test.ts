import { afterAll, beforeAll, describe, expect, test } from "vitest";
import { ok } from "node:assert";
import { CreationOptional, DataTypes, InferAttributes, InferCreationAttributes, Model, Sequelize } from "sequelize";
import { fromSequelizeTable } from "@vexnor/sequelize";
import { row, sql, param } from "@vexnor/core";
import "@vexnor/mssql";
import { pool } from "./mssql-pool.js";
import { getTag } from "./tags.js";

class AccountModel extends Model<InferAttributes<AccountModel>, InferCreationAttributes<AccountModel>> {
   declare accountId: CreationOptional<string>;
   declare parentId: string | null;
   declare status: string | null;
   declare email: string;
   declare firstName: string;
   declare lastName: string;
   declare notes: string | null;
   declare createdAt: Date | null;
   declare modifiedAt: Date | null;
}

let sequelize: Sequelize;
let Account: ReturnType<typeof fromSequelizeTable<AccountModel>>;

describe.sequential("e2e sequelize/mssql — fromSequelizeTable works against real DB", (ctx) => {
   const TAG = getTag(ctx);
   let account!: InferAttributes<AccountModel>;

   beforeAll(async () => {
      sequelize = new Sequelize({
         dialect: "mssql",
         database: "vexnor",
         username: "vexnor_dev",
         password: "P@ssw0rd!",
         host: "localhost",
         port: 1433,
         logging: false,
      });

      AccountModel.init(
         {
            accountId: { type: DataTypes.UUID, allowNull: false, primaryKey: true, field: "account_id" },
            parentId: { type: DataTypes.UUID, allowNull: true, field: "parent_id" },
            status: { type: DataTypes.STRING(50), allowNull: true, field: "status" },
            email: { type: DataTypes.STRING(255), allowNull: false, field: "email" },
            firstName: { type: DataTypes.STRING(100), allowNull: false, field: "first_name" },
            lastName: { type: DataTypes.STRING(100), allowNull: false, field: "last_name" },
            notes: { type: DataTypes.TEXT, allowNull: true, field: "notes" },
            createdAt: { type: DataTypes.DATE, allowNull: true, field: "created_at" },
            modifiedAt: { type: DataTypes.DATE, allowNull: true, field: "modified_at" },
         },
         {
            sequelize,
            modelName: "AccountModel",
            tableName: "account",
            schema: "vexnor_dev",
            timestamps: false,
         },
      );

      Account = fromSequelizeTable(AccountModel);

      account = await Account.mssql.insertRows().one({
         db: pool.request(),
         params: { rows: [{ email: `${TAG}@example.com`, firstName: "Sequelize", lastName: "Test" }] },
      });
      ok(account, "account not inserted");
   });

   afterAll(async () => {
      await sequelize.close();
   });

   test("sql: insert and select", async () => {
      const inserted = await sql`
         INSERT INTO ${Account}
            ${Account.insertCols({ email: `${TAG}-sql@example.com`, firstName: "SqlSequelize", lastName: "Test" })}
            OUTPUT ${row(Account.as("inserted").$$)}
            ${Account.insertVals({ email: `${TAG}-sql@example.com`, firstName: "SqlSequelize", lastName: "Test" })}
      `.mssql.one({ db: pool.request() });

      expect(inserted.email).toBe(`${TAG}-sql@example.com`);
      expect(inserted.firstName).toBe("SqlSequelize");
      expect(inserted.accountId).toBeDefined();

      await sql`DELETE FROM ${Account} WHERE ${Account.$accountId} = ${inserted.accountId}`.mssql.run({ db: pool.request() });
   });

   test("crud: insertRows", async () => {
      expect(account.email).toBe(`${TAG}@example.com`);
      expect(account.firstName).toBe("Sequelize");
      expect(account.accountId).toBeDefined();
   });

   test("crud: findById", async () => {
      const result = await Account.mssql.findById().any({ db: pool.request(), params: { accountId: account.accountId } });
      expect(String(result?.accountId).toLowerCase()).toBe(String(account.accountId).toLowerCase());
      expect(result?.email).toBe(account.email);
   });

   test("crud: findBy", async () => {
      const result = await Account.mssql.findBy().any({ db: pool.request(), params: { email: account.email } });
      expect(String(result?.accountId).toLowerCase()).toBe(String(account.accountId).toLowerCase());
   });

   test("crud: select with WHERE", async () => {
      const idParam = param<{ id: string }>("id");
      const results = await Account.mssql.select({
         WHERE: sql`${Account.$accountId} = ${idParam}`,
      }).all({ db: pool.request(), params: { id: account.accountId } });
      expect(results).toHaveLength(1);
      expect(String(results[0]!.accountId).toLowerCase()).toBe(String(account.accountId).toLowerCase());
   });

   test("crud: update", async () => {
      const idParam = param<{ id: string }>("id");
      const updated = await Account.mssql.update({
         WHERE: sql`${Account.$accountId} = ${idParam}`,
      }).one({ db: pool.request(), params: { set: { firstName: "Updated" }, id: account.accountId } });
      expect(updated.firstName).toBe("Updated");
      account = updated;
   });

   test("crud: upsert", async () => {
      const upserted = await Account.mssql.upsert({ MERGE_ON: [Account.$accountId] }).one({
         db: pool.request(),
         params: {
            rows: [{ accountId: account.accountId, email: account.email, firstName: "Upserted", lastName: "Test" }],
         },
      });
      expect(String(upserted.accountId).toLowerCase()).toBe(String(account.accountId).toLowerCase());
      expect(upserted.firstName).toBe("Upserted");
      account = upserted;
   });

   test("crud: delete", async () => {
      const deleted = await Account.mssql.delete({
         WHERE: sql`${Account.$accountId} = ${param<{ id: string }>("id")}`,
      }).all({ db: pool.request(), params: { id: account.accountId } });
      expect(deleted).toHaveLength(1);
      expect(String(deleted[0]!.accountId).toLowerCase()).toBe(String(account.accountId).toLowerCase());
   });
});

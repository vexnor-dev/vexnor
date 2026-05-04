import "reflect-metadata";
import { afterAll, beforeAll, describe, expect, test } from "vitest";
import { DataSource, EntitySchema } from "typeorm";
import { sql, row, val, param } from "valnor";
import { fromTypeORM } from "../index.js";

interface IAccount extends Record<string, unknown> {
   accountId: string;
   email: string;
   firstName: string;
   notes: string | null;
   parentId: string | null;
}

interface IOrder extends Record<string, unknown> {
   orderId: string;
   accountId: string;
   total: number | null;
}

const AccountSchema = new EntitySchema<IAccount>({
   name: "Account",
   tableName: "account",
   schema: "main",
   columns: {
      accountId: { type: String, primary: true, name: "account_id" },
      email: { type: String, name: "email", nullable: false },
      firstName: { type: String, name: "first_name", nullable: false },
      notes: { type: String, name: "notes", nullable: true },
      parentId: { type: String, name: "parent_id", nullable: true },
   },
});

const OrderSchema = new EntitySchema<IOrder>({
   name: "Order",
   tableName: "order",
   schema: "main",
   columns: {
      orderId: { type: String, primary: true, name: "order_id" },
      accountId: { type: String, name: "account_id", nullable: false },
      total: { type: Number, name: "total", nullable: true },
   },
});

let dataSource: DataSource;

beforeAll(async () => {
   dataSource = new DataSource({
      type: "better-sqlite3",
      database: ":memory:",
      entities: [AccountSchema, OrderSchema],
   });
   await dataSource.initialize();
});

afterAll(async () => {
   await dataSource.destroy();
});

describe("fromTypeORM — EntitySchema SQL generation", () => {
   let Account!: ReturnType<typeof fromTypeORM<IAccount>>;
   let Order!: ReturnType<typeof fromTypeORM<IOrder>>;

   beforeAll(() => {
      Account = fromTypeORM(dataSource.getRepository(AccountSchema));
      Order = fromTypeORM(dataSource.getRepository(OrderSchema));
   });

   test("SELECT all columns", () => {
      expect(sql`SELECT ${row(Account.$$)} FROM ${Account}`.getSql({}).text).toMatchInlineSnapshot(`
        "/* <query_0> */
        SELECT
          "a_1"."account_id" AS "accountId",
          "a_1"."email",
          "a_1"."first_name" AS "firstName",
          "a_1"."notes",
          "a_1"."parent_id" AS "parentId"
        FROM
          "main"."account" AS "a_1" /* </query_0> */"
      `);
   });

   test("SELECT specific columns", () => {
      expect(sql`SELECT ${row(Account.$accountId, Account.$email)} FROM ${Account}`.getSql({}).text).toMatchInlineSnapshot(`
        "/* <query_0> */
        SELECT
          "a_1"."account_id" AS "accountId",
          "a_1"."email"
        FROM
          "main"."account" AS "a_1" /* </query_0> */"
      `);
   });

   test("SELECT with WHERE param", () => {
      const idParam = param<{ id: string }>("id");
      expect(
         sql`SELECT ${row(Account.$$)} FROM ${Account} WHERE ${Account.$accountId} = ${idParam}`.getSql({ params: { id: "123" } }).text,
      ).toMatchInlineSnapshot(`
        "/* <query_0> */
        SELECT
          "a_1"."account_id" AS "accountId",
          "a_1"."email",
          "a_1"."first_name" AS "firstName",
          "a_1"."notes",
          "a_1"."parent_id" AS "parentId"
        FROM
          "main"."account" AS "a_1"
        WHERE
          "a_1"."account_id" = ? /* </query_0> */"
      `);
   });

   test("SELECT with column alias", () => {
      expect(sql`SELECT ${row(Account.$firstName.as("name"))} FROM ${Account}`.getSql({}).text).toMatchInlineSnapshot(`
        "/* <query_0> */
        SELECT
          "a_1"."first_name" AS "name"
        FROM
          "main"."account" AS "a_1" /* </query_0> */"
      `);
   });

   test("SELECT with aggregate val()", () => {
      expect(
         sql`SELECT ${row(Account.$accountId, val`COUNT(*)`.as<{ total: number }>("total"))} FROM ${Account} GROUP BY ${Account.$accountId}`.getSql({}).text,
      ).toMatchInlineSnapshot(`
        "/* <query_0> */
        SELECT
          "a_1"."account_id" AS "accountId",
          /* <query_1> */ COUNT(*) /* </query_1> */ AS "total"
        FROM
          "main"."account" AS "a_1"
        GROUP BY
          "a_1"."account_id" /* </query_0> */"
      `);
   });

   test("SELECT with table alias (.as())", () => {
      const Parent = Account.as("parent");
      expect(
         sql`SELECT ${row(Account.$$, Parent.$email.as("parentEmail"))} FROM ${Account} JOIN ${Parent} ON ${Parent.$accountId} = ${Account.$parentId}`.getSql({}).text,
      ).toMatchInlineSnapshot(`
        "/* <query_0> */
        SELECT
          "a_1"."account_id" AS "accountId",
          "a_1"."email",
          "a_1"."first_name" AS "firstName",
          "a_1"."notes",
          "a_1"."parent_id" AS "parentId",
          "parent"."email" AS "parentEmail"
        FROM
          "main"."account" AS "a_1"
          JOIN "main"."account" AS "parent" ON "parent"."account_id" = "a_1"."parent_id" /* </query_0> */"
      `);
   });

   test("SELECT with JOIN", () => {
      expect(
         sql`SELECT ${row(Account.$accountId, Order.$orderId)} FROM ${Account} JOIN ${Order} ON ${Order.$accountId} = ${Account.$accountId}`.getSql({}).text,
      ).toMatchInlineSnapshot(`
        "/* <query_0> */
        SELECT
          "a_1"."account_id" AS "accountId",
          "o_2"."order_id" AS "orderId"
        FROM
          "main"."account" AS "a_1"
          JOIN "main"."order" AS "o_2" ON "o_2"."account_id" = "a_1"."account_id" /* </query_0> */"
      `);
   });

   test("INSERT insertColsVals", () => {
      expect(
         sql`INSERT INTO ${Account} ${Account.insertColsVals({ accountId: "some-id", email: "a@b.com", firstName: "John", notes: null, parentId: null })} RETURNING ${row(Account.$$)}`.getSql({}).text,
      ).toMatchInlineSnapshot(`
        "/* <query_0> */
        INSERT INTO
          "main"."account" (
            "account_id",
            "email",
            "first_name",
            "notes",
            "parent_id"
          )
        VALUES
          (?, ?, ?, ?, ?)
        RETURNING
          "account"."account_id" AS "accountId",
          "account"."email",
          "account"."first_name" AS "firstName",
          "account"."notes",
          "account"."parent_id" AS "parentId" /* </query_0> */"
      `);
   });

   test("UPDATE updateSet", () => {
      expect(
         sql`UPDATE ${Account} SET ${Account.updateSet({ email: "new@b.com" })} WHERE ${Account.$accountId} = ${"some-id"}`.getSql({}).text,
      ).toMatchInlineSnapshot(`
        "/* <query_0> */
        UPDATE "main"."account"
        SET
          "email" = ?
        WHERE
          "account"."account_id" = ? /* </query_0> */"
      `);
   });

   test("DELETE", () => {
      expect(
         sql`DELETE FROM ${Account} WHERE ${Account.$accountId} = ${"some-id"}`.getSql({}).text,
      ).toMatchInlineSnapshot(`
        "/* <query_0> */
        DELETE FROM "main"."account"
        WHERE
          "account"."account_id" = ? /* </query_0> */"
      `);
   });
});

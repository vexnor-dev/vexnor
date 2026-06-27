import { assertType, describe, expect, test } from "vitest";
import { Account } from "@test-models/vexnor_dev.account-table.js";
import { Order } from "@test-models/vexnor_dev.order-table.js";
import { input } from "#src/core/query/sql-input.js";
import { sql } from "#src/core/sql.js";
import {
   sqlSelect,
   SqlSelectResultRow,
   SqlTableReadRowIncludeMany,
   SqlTableReadRowIncludeOne,
} from "#src/core/crud/sql-select.js";
import { SqlQuery } from "#src/core/query/sql-query.js";
import { IOrderSelect } from "@test-models/vexnor_dev.order-table.js";
import { IAccountSelect, OrderStatusUdt } from "#src/test/testing.js";
import { param, ctx } from "#src/core/query/sql-param.js";
import { ParamsOf, TypeOf } from "#src/core/sql-base.js";
import { row } from "#src/core/query/sql-select-row.js";
import { col } from "#src/core/query/sql-select-column.js";
import { testSelect } from "#src/test/test-select.js";

describe("sqlTableRead()", () => {
   test("SqlTableReadRowIncludeOne<> should infer type", () => {
      type Target = SqlTableReadRowIncludeOne<{ includeOne: { order: SqlQuery<{ Row: IOrderSelect }> } }>;
      assertType<Target>({
         order: {
            orderId: "",
            accountId: "",
            status: OrderStatusUdt.CREATED,
            createdAt: new Date(),
            modifiedAt: new Date(),
            // @ts-expect-error extra field
            test: "a",
         },
      });
   });

   test("SqlTableReadRowIncludeMany<> should infer type", () => {
      type Target = SqlTableReadRowIncludeMany<{ includeMany: { orders: SqlQuery<{ Row: IOrderSelect }> } }>;
      assertType<Target>({
         orders: [
            {
               orderId: "",
               accountId: "",
               status: OrderStatusUdt.CREATED,
               createdAt: new Date(),
               modifiedAt: new Date(),
               // @ts-expect-error extra field
               test: "a",
            },
         ],
      });
   });

   test("SqlTableReadResultRow<> should includeOne/includeMany", () => {
      type Target = SqlSelectResultRow<
         { Select: { accountId: string } },
         {
            includeMany: {
               monthlyOrders: SqlQuery<{ Row: { orderId: string } }>;
               monthlyProducts: SqlQuery<{ Row: { productId: string } }>;
            };
            includeOne: {
               lastOrder: SqlQuery<{ Row: { orderId: string } }>;
               lastProduct: SqlQuery<{ Row: { productId: string } }>;
            };
         }
      >;
      assertType<Target>({
         accountId: "",
         monthlyOrders: [{ orderId: "" }],
         monthlyProducts: [{ productId: "" }],
         lastOrder: { orderId: "" },
         lastProduct: { productId: "" },
         // @ts-expect-error extra field
         test: "a",
      });
   });

   describe("row type inference from SqlSelectArgs", () => {
      const orderCount = col<{ orderCount: number }>("orderCount");

      test("SELECT override with row(T.$$) + col produces base columns plus extra", () => {
         // eslint-disable-next-line unused-imports/no-unused-vars
         const query = sqlSelect(Account, {
            SELECT: sql`${row(Account.$$)}, (select count(*)) as ${orderCount}`,
         });
         type Row = TypeOf<typeof query>;
         // must include all base IAccountSelect fields plus orderCount
         assertType<Row>({
            accountId: "",
            email: "",
            firstName: "",
            lastName: "",
            status: "created" as IAccountSelect["status"],
            notes: null,
            createdAt: new Date(),
            modifiedAt: new Date(),
            parentId: null,
            orderCount: 0,
            // @ts-expect-error not in result
            other: "",
         });
      });

      test("includeOne result row adds T | null field to base columns", () => {
         const firstOrder = sql`select ${row(Order.$$)} from ${Order}`;
         type Row = SqlSelectResultRow<{ Select: IAccountSelect }, { includeOne: { firstOrder: typeof firstOrder } }>;
         // base columns present
         assertType<Row["accountId"]>("");
         assertType<Row["email"]>("");
         // includeOne field is T | null
         assertType<Row["firstOrder"]>(null);
         assertType<Row["firstOrder"]>({
            orderId: "",
            status: "created" as IOrderSelect["status"],
            createdAt: new Date(),
            modifiedAt: new Date(),
            accountId: "",
         });
      });
   });

   test("should generate find query without where clause", () => {
      const query = sqlSelect(Account, {});

      expect(query).toBeDefined();
      const { text } = query.getSql({ params: {}, options: { dialect: "sqlite" } });
      expect(text).toMatchInlineSnapshot(`
        "/* <query_0> */
        SELECT
          "a_1"."account_id" AS "accountId",
          "a_1"."status",
          "a_1"."email",
          "a_1"."first_name" AS "firstName",
          "a_1"."last_name" AS "lastName",
          "a_1"."notes",
          "a_1"."created_at" AS "createdAt",
          "a_1"."modified_at" AS "modifiedAt",
          "a_1"."parent_id" AS "parentId"
        FROM
          "main"."account" AS "a_1"
          /* <query_1> */
          /* </query_1> */
          /* <query_2> */
          /* </query_2> */
          /* </query_0> */"
      `);
   });

   test("should generate find query with where clause", () => {
      const params = input<{ id: string }>();
      const query = sqlSelect(Account, { WHERE: sql`${Account.$accountId} = ${params.$id}` });

      expect(query).toBeDefined();
      const { text } = query.getSql({ params: { id: "test-id" }, options: { dialect: "sqlite" } });
      expect(text).toMatchInlineSnapshot(`
        "/* <query_0> */
        SELECT
          "a_1"."account_id" AS "accountId",
          "a_1"."status",
          "a_1"."email",
          "a_1"."first_name" AS "firstName",
          "a_1"."last_name" AS "lastName",
          "a_1"."notes",
          "a_1"."created_at" AS "createdAt",
          "a_1"."modified_at" AS "modifiedAt",
          "a_1"."parent_id" AS "parentId"
        FROM
          "main"."account" AS "a_1"
          /* <query_1> */
        WHERE
          /* <query_2> */ "a_1"."account_id" = ? /* </query_2> */ /* </query_1> */
          /* <query_3> */
          /* </query_3> */
          /* </query_0> */"
      `);
   });

   test("should return query with correct row type", () => {
      const query = sqlSelect(Account, {});
      expect(query.row).toBeDefined();
   });

   describe("param propagation through SqlSelectArgs clauses", () => {
      const emailParam = param<{ email: string }>("email");
      const filterParam = param<{ filter?: string }>("filter");
      const extraParam = param<{ extra: number }>("extra");
      const dirParam = param<{ dir: string }>("dir");

      test("param in WHERE propagates to ParamsOf query", () => {
         // eslint-disable-next-line unused-imports/no-unused-vars
         const query = sqlSelect(Account, {
            WHERE: sql`${Account.$email} = ${emailParam}`,
         });
         type Params = ParamsOf<typeof query>;
         assertType<Params>({
            email: "a@b.com",
            // @ts-expect-error not declared
            other: "x",
         });
      });

      test("optional param in WHERE propagates as optional", () => {
         // eslint-disable-next-line unused-imports/no-unused-vars
         const query = sqlSelect(Account, {
            WHERE: sql`${Account.$email} = ${filterParam}`,
         });
         type Params = ParamsOf<typeof query>;
         assertType<Params>({});
         assertType<Params>({ filter: "x" });
      });

      test("param in SELECT propagates to ParamsOf query", () => {
         // eslint-disable-next-line unused-imports/no-unused-vars
         const query = sqlSelect(Account, {
            SELECT: sql`${row(Account.$$)}, ${col<{ extra: number }>("extra")} as ${extraParam}`,
         });
         type Params = ParamsOf<typeof query>;
         assertType<Params>({
            extra: 1,
            // @ts-expect-error not declared
            other: "x",
         });
      });

      test("param in ORDER_BY propagates to ParamsOf query", () => {
         // eslint-disable-next-line unused-imports/no-unused-vars
         const query = sqlSelect(Account, {
            ORDER_BY: sql`${Account.$createdAt} ${dirParam}`,
         });
         type Params = ParamsOf<typeof query>;
         assertType<Params>({
            dir: "desc",
            // @ts-expect-error not declared
            other: "x",
         });
      });

      test("params across multiple clauses merge into single Params type", () => {
         // eslint-disable-next-line unused-imports/no-unused-vars
         const query = sqlSelect(Account, {
            WHERE: sql`${Account.$email} = ${emailParam}`,
            ORDER_BY: sql`${Account.$createdAt} ${dirParam}`,
         });
         type Params = ParamsOf<typeof query>;
         assertType<Params>({
            email: "a@b.com",
            dir: "desc",
            // @ts-expect-error not declared
            other: "x",
         });
      });
   });

   describe("param and row type with includeOne / includeMany (via testSelect)", () => {
      const emailParam = param<{ email: string }>("email");
      const userIdRuntime = ctx<{ userId: string }>("userId");
      const limitParam = param<{ limit: number }>("limit");
      const orderCount = col<{ orderCount: number }>("orderCount");

      const orderItems = sql`select ${row(Order.$$)} from ${Order} where ${Order.$accountId} = ${Account.out.$accountId}`;
      const orders = sql`select ${row(Order.$$)} from ${Order} where ${Order.$accountId} = ${Account.out.$accountId} limit ${limitParam}`;

      test("WHERE runtime + includeMany: params propagate", () => {
         // eslint-disable-next-line unused-imports/no-unused-vars
         const query = testSelect(Account, {
            WHERE: sql`${Account.$accountId} = ${userIdRuntime}`,
            includeMany: { orders: orderItems },
         });
         type Params = ParamsOf<typeof query>;
         assertType<Params>({ userId: "abc" });
      });

      test("WHERE param + includeOne: params propagate", () => {
         // eslint-disable-next-line unused-imports/no-unused-vars
         const query = testSelect(Account, {
            WHERE: sql`${Account.$email} = ${emailParam}`,
            includeOne: { lastOrder: orderItems },
         });
         type Params = ParamsOf<typeof query>;
         assertType<Params>({ email: "a@b.com" });
      });

      test("WHERE param + includeMany subquery param: all params merge", () => {
         // eslint-disable-next-line unused-imports/no-unused-vars
         const query = testSelect(Account, {
            WHERE: sql`${Account.$email} = ${emailParam}`,
            includeMany: { orders },
         });
         type Params = ParamsOf<typeof query>;
         assertType<Params>({ email: "a@b.com", limit: 10 });
         assertType<Params>({
            email: "a@b.com",
            limit: 10,
            // @ts-expect-error not declared
            other: "x",
         });
      });

      test("SELECT override + includeMany: row includes base columns + extra + nested", () => {
         // eslint-disable-next-line unused-imports/no-unused-vars
         const query = testSelect(Account, {
            SELECT: sql`${row(Account.$$)}, (select count(*)) as ${orderCount}`,
            includeMany: { orders: orderItems },
         });
         type Row = TypeOf<typeof query>;
         assertType<Row["accountId"]>("");
         assertType<Row["email"]>("");
         assertType<Row["orderCount"]>(0);
         assertType<Row["orders"]>([]);
      });

      test("includeOne row field is T | null", () => {
         // eslint-disable-next-line unused-imports/no-unused-vars
         const query = testSelect(Account, {
            includeOne: { lastOrder: orderItems },
         });
         type Row = TypeOf<typeof query>;
         assertType<Row["accountId"]>("");
         assertType<Row["lastOrder"]>(null);
         assertType<Row["lastOrder"]>({
            orderId: "",
            status: "created" as IOrderSelect["status"],
            createdAt: new Date(),
            modifiedAt: new Date(),
            accountId: "",
         });
      });
   });
});

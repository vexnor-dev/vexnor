import { assertType, describe, expect, test } from "vitest";
import { Account } from "@test-models/vexnor_dev.account-table.js";
import { input } from "#/core/query/sql-input.js";
import { sql } from "#/core/sql.js";
import {
   sqlSelect,
   SqlSelectResultRow,
   SqlTableReadRowIncludeMany,
   SqlTableReadRowIncludeOne,
} from "#/core/crud/sql-select.js";
import { SqlQuery } from "#/core/query/sql-query.js";
import { IOrderSelect } from "@test-models/vexnor_dev.order-table.js";
import { OrderStatusUdt } from "#/test/testing.js";

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

   test("should generate find query without where clause", () => {
      const query = sqlSelect(Account, {});

      expect(query).toBeDefined();
      const { text } = query.getSql({ options: { dialect: "sqlite" } });
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
          /* </query_0> */"
      `);
   });

   test("should return query with correct row type", () => {
      const query = sqlSelect(Account, {});
      expect(query.row).toBeDefined();
   });
});

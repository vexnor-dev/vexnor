import { assertType, describe, expect, test } from "vitest";
import { Account, IAccountSelect } from "./models/valnor_test.account-table.js";
import { InferTable$RowBySelect } from "../types/index.js";
import { newSqlTableColumn } from "../schema/index.js";
import { param, SqlParam } from "../query/index.js";
import { ParamsOf, ParamsOfArgs } from "../sql-base.js";
import { sql } from "../sql.js";

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

   test("ParamsOfArgs should merge params from objects", () => {
      // eslint-disable-next-line unused-imports/no-unused-vars
      const target = {
         one: {
            value: param<{ one: string }>("one"),
         },
         two: {
            value: param<{ two: number }>("two"),
         },
      };
      type Actual = ParamsOfArgs<typeof target>;
      assertType<Actual>({
         one: { value: "one" },
         two: { value: 2 },
         // @ts-expect-error - Testing param validation
         error: "a",
      });
   });

   test("ParamsOfArgs should merge params from types", () => {
      type Target = {
         one: {
            value: SqlParam<{ Name: "one"; Type: string }>;
         };
         two: {
            value: SqlParam<{ Name: "two"; Type: number }>;
         };
      };
      type Actual = ParamsOfArgs<Target>;
      assertType<Actual>({
         one: { value: "one" },
         two: { value: 2 },
      });
   });

   test("ParamsOfKeys should merge params from types with required", () => {
      type Target = {
         where: {
            email: SqlParam<{ Name: "email"; Type: string }>;
         };
         groupBy: {
            parentId: SqlParam<{ Name: "parentId"; Type: string }>;
         };
      };
      type Actual = ParamsOfArgs<Target>;
      assertType<Actual>({
         where: { email: "a" },
         groupBy: { parentId: "." },
      });
   });

   test("ParamsOfKeys should merge params from types with optionals", () => {
      type Target = {
         where?: {
            email: SqlParam<{ Name: "email"; Type: string }>;
         };
         groupBy: {
            parentId: SqlParam<{ Name: "parentId"; Type: string }>;
         };
      };
      type Actual = ParamsOfArgs<Target>;
      assertType<Actual>({
         where: { email: "a" },
         groupBy: { parentId: "." },
         // @ts-expect-error - field never
         error: "a",
      });

      assertType<Actual>({
         groupBy: {
            parentId: ".",
            // @ts-expect-error - field never
            error: "a",
         },
      });
   });

   test("ParamsOfKeys should merge params from types with required", () => {
      type Target = {
         where?: {
            email: SqlParam<{ Name: "email"; Type: string }>;
         };
      };
      type Actual = ParamsOfArgs<Target>;
      assertType<Actual>({});
   });

   test("ParamsOf<SqlParam<{}>> is {}", () => {
      // eslint-disable-next-line unused-imports/no-unused-vars
      const id1 = param<{ id1: string }>("id1");
      type Params = ParamsOf<typeof id1>;
      assertType<Params>({
         id1: "",
         // @ts-expect-error - Testing runtime validation of extra property
         test: "a",
      });
   });

   test("ParamsOf<SqlQuery<{Params:{}}>> is {}", () => {
      // eslint-disable-next-line unused-imports/no-unused-vars
      const id1 = sql`${param<{ id1: string }>("id1")}`;
      type Params = ParamsOf<typeof id1>;
      assertType<Params>({
         id1: "",
         // @ts-expect-error - Testing runtime validation of extra property
         test: "a",
      });
   });

   test("ParamsOf<SqlQuery<{Params:void}>> is void", () => {
      // eslint-disable-next-line unused-imports/no-unused-vars
      const id1 = sql`${Account}`;
      type Params = ParamsOf<typeof id1>;
      assertType<Params>(void 0);
   });

   test("ParamsOfKeys<{ a: SqlQuery<{Params:void}>; b: SqlQuery<{Params:{}}> }> is {}", () => {
      // eslint-disable-next-line unused-imports/no-unused-vars
      const target = {
         a: sql`${Account}`,
         b: sql`${param<{ id1: string }>("id1")}`,
      };
      type Params = ParamsOfArgs<typeof target>;
      assertType<Params>({
         b: { id1: "a" },
      });
   });
});

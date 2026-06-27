import { assertType, describe, expect, test } from "vitest";
import { Account, IAccountSelect } from "@test-models/vexnor_dev.account-table.js";
import { InferTable$RowBySelect } from "#src/core/types/infer-types.js";
import { newSqlTableColumn } from "#src/core/schema/sql-table-column.js";
import { param, SqlParam } from "#src/core/query/sql-param.js";
import { ParamsOf, ParamsOfArgs } from "#src/core/sql-base.js";
import { sql } from "#src/core/sql.js";
import { Void } from "#src/core/utils/utility-types.js";

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
         one: "one",
         two: 2,
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
         one: "one",
         two: 2,
         // @ts-expect-error - Testing param validation
         error: "a",
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
         email: "a",
         parentId: ".",
         // @ts-expect-error - Testing param validation
         error: "a",
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
         email: "a",
         parentId: ".",
         // @ts-expect-error - Testing param validation
         error: "a",
      });
   });

   test("ParamsOfKeys should merge params from types with only optional", () => {
      type Target = {
         where?: {
            email: SqlParam<{ Name: "email"; Type: string }>;
         };
      };
      type Actual = ParamsOfArgs<Target>;
      assertType<Actual>({
         email: "a",
      });
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
         id1: "a",
      });
   });

   test("Void<{}> should trim void props", () => {
      type Target = { name: void; city: string };
      assertType<Void<Target>>({
         name: void 0,
         city: "test",
      });
   });
});

   test("ParamsOfArgs: param in WHERE + void-param subquery in includeMany", () => {
      const withParam = sql`${param<{ userId: string }>("userId")}`;
      const noParam = sql`${Account}`;
      type Args = {
         WHERE: typeof withParam;
         includeMany: { items: typeof noParam };
      };
      type P = ParamsOfArgs<Args>;
      // must be { userId: string }, not void
      assertType<P>({ userId: "abc" });
   });

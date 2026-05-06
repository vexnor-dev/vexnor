import { beforeEach, describe, expect, test } from "vitest";
import { DefaultFormatter } from "#/core/builder/default-formatter.js";
import { SqlBuildContext } from "#/core/builder/sql-build-context.js";
import { DefaultTokenizer } from "#/core/builder/default-tokenizer.js";

describe("DefaultFormatter", () => {
   let formatter: DefaultFormatter;
   let context: SqlBuildContext;

   beforeEach(() => {
      formatter = new DefaultFormatter();
      context = new SqlBuildContext({
         tokenizer: new DefaultTokenizer(),
         formatter: new DefaultFormatter(),
      });
   });

   describe("SqlTable Formatting", () => {
      const tableTestCases: { keyword: string; input: string; expected: string }[] = [
         { keyword: "with", input: "with ", expected: "tableAlias" },
         { keyword: "select", input: "select ", expected: "tableAlias" },
         { keyword: "from", input: "from ", expected: "schema.tableName AS tableAlias" },
         { keyword: "update", input: "update ", expected: "schema.tableName" },
         { keyword: "insert into", input: "insert into ", expected: "schema.tableName" },
         { keyword: "delete from", input: "delete from ", expected: "schema.tableName" },
         { keyword: "join", input: "join ", expected: "schema.tableName AS tableAlias" },
         { keyword: "fn", input: "my_func(", expected: "tableAlias" },
      ];

      test.each(tableTestCases)(`should format for "$keyword" as "$expected"`, ({ keyword, input, expected }) => {
         context.next(input);
         expect(context.keyword).toEqual(keyword);
         const format = formatter.getTableFormat(context);
         expect(format).toBe(expected);
      });

      test("should return default format for unknown keyword", () => {
         context.next("unknown_keyword");
         const format = formatter.getTableFormat(context);
         expect(format).toBe("schema.tableName");
      });

      test("should return default format for no keyword", () => {
         const format = formatter.getTableFormat(context);
         expect(format).toBe("schema.tableName");
      });
   });

   describe("SqlColumn Formatting", () => {
      const columnTestCases: { keyword: string; input: string; expected: string }[] = [
         { keyword: "select", input: "select ", expected: "tableAlias.columnName AS columnAlias" },
         { keyword: "returning", input: "returning ", expected: "tableName.columnName AS columnAlias" },
         { keyword: "output", input: "output ", expected: "tableAlias.columnName AS columnAlias" },
         { keyword: "fn", input: "select my_func(", expected: "tableAlias.columnName" },
         { keyword: "where", input: "where ", expected: "tableAlias.columnName" },
         { keyword: "on", input: "on ", expected: "tableAlias.columnName" },
         { keyword: "insert into", input: "insert into (", expected: "columnName" },
         { keyword: "values", input: "values (", expected: "columnName" },
         { keyword: "set", input: "set ", expected: "columnName" },
         { keyword: "group by", input: "group by ", expected: "tableAlias.columnName" },
         { keyword: "order by", input: "order by ", expected: "tableAlias.columnName" },
      ];

      for (const { keyword, input, expected } of columnTestCases) {
         test(`should format for "${keyword}" as "${expected}"`, () => {
            context.next(input);
            const format = formatter.getColumnFormat(context);
            expect(format).toBe(expected);
         });
      }

      test("should return default format for unknown keyword", () => {
         context.next("unknown_keyword");
         const format = formatter.getColumnFormat(context);
         expect(format).toBe("tableAlias.columnName");
      });

      test("should return default format for no keyword", () => {
         const format = formatter.getColumnFormat(context);
         expect(format).toBe("tableAlias.columnName");
      });
   });
});

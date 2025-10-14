import { beforeEach, describe, expect, test } from "vitest";
import { SqlQueryContext } from "../query/index.js";
import { SqlBuildError } from "../sql-build-error.js";
import { DefaultTokenizer } from "../default-tokenizer.js";
import { SqlFormatter } from "../sql-formatter.js";

describe("New QueryContext Engine", () => {
   let context!: SqlQueryContext;

   beforeEach(() => {
      context = new SqlQueryContext({
         queryName: "test",
         tokenizer: new DefaultTokenizer("test"),
         formatter: new SqlFormatter(),
      });
   });

   describe("Formatting Keyword (Ghosting)", () => {
      test("should return the last major keyword, ignoring a trailing comma", () => {
         context.next("select a, b as B,");
         expect(context.keyword).toBe("select");
      });

      test("should return the last major keyword, ignoring 'as'", () => {
         context.next("select a as");
         expect(context.keyword).toBe("select");
      });

      test("should return the major keyword inside a CASE statement", () => {
         context.next("select case when a > 1 then");
         expect(context.keyword).toBe("select");
         context.next("'big' else");
         expect(context.keyword).toBe("select");
         context.next("'small' end");
         expect(context.keyword).toBe("select");
      });

      test("should return the major keyword after a CASE statement with an alias", () => {
         context.next("select case when a > 1 then 'big' end as status,");
         expect(context.keyword).toBe("select");
      });
   });

   describe("Hierarchical Contexts (2D Stack)", () => {
      test("should identify 'fn' context inside a function call", () => {
         context.next("select max(");
         expect(context.keyword).toBe("fn");
      });

      test("should revert to parent context after a function call", () => {
         context.next("select max(a)");
         expect(context.keyword).toBe("select");
      });

      test("should identify a new subquery context", () => {
         context.next("select * from (");
         context.next("select id from users where");
         expect(context.keyword).toBe("where");
      });

      test("should revert to parent context after a subquery", () => {
         context.next("select * from (select id from users) as u");
         expect(context.keyword).toBe("from");
      });

      test("should handle nested functions and subqueries", () => {
         context.next("select * from users where id in (");
         context.next("select user_id from (");
         context.next("select max("); // <-- Split the line here
         // We are NOW inside the max() function call
         expect(context.keyword).toBe("fn");
         context.next("user_id) from logins"); // <-- Process the rest
         // We are back in the 'select user_id from ...' subquery
         expect(context.keyword).toBe("from");
         context.next(") as sub");
         context.next(")");
         // We are back in the main query's WHERE clause
         expect(context.keyword).toBe("where");
      });
   });

   describe("Security Enforcement", () => {
      test("should throw SqlBuildError for '?' parameter marker", () => {
         expect(() => context.next("select * from users where id = ?")).toThrow(SqlBuildError);
      });

      test("should throw SqlBuildError for '$' parameter marker", () => {
         expect(() => context.next("select * from users where id = $1")).toThrow(SqlBuildError);
      });

      test("should throw SqlBuildError for '@' parameter marker", () => {
         expect(() => context.next("select * from users where id = @id")).toThrow(SqlBuildError);
      });

      test("should NOT throw for valid uses of '$' in strings or identifiers", () => {
         expect(() => context.next("select 'not a param $', \"my$col\"")).not.toThrow();
      });
   });
});

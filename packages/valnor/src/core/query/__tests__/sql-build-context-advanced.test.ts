import { beforeEach, describe, expect, test } from "vitest";
import { SqlBuildContext } from "../sql-build-context.js";
import { DefaultTokenizer } from "../../default-tokenizer.js";
import { DefaultFormatter } from "../../default-formatter.js";

describe("Advanced SqlBuildContext Engine Stress Tests", () => {
   let context!: SqlBuildContext;

   beforeEach(() => {
      context = new SqlBuildContext({
         tokenizer: new DefaultTokenizer(),
         formatter: new DefaultFormatter(),
      });
   });

   test("BREAK THE PARSER: should not create a new context for simple expression grouping", () => {
      // This tests the assumption that '(' always means a subquery or function.
      // Here, it's just for precedence. The context should remain 'where'.
      context.next("select * from users where (");
      context.next("name = 'a' or");
      expect(context.keyword).toBe("where");
      context.next("email = 'b' ) and status = 1");
      expect(context.keyword).toBe("where");
   });

   test("BREAK THE PARSER: should correctly identify a subquery with leading comments", () => {
      // This tests the naive "peek-ahead" logic. A comment between '(' and 'select'
      // will fool the current engine into thinking this is a function call.
      context.next("select * from ( -- a subquery\n select id from users");
      expect(context.keyword).toBe("from");
      context.next(") as u");
      expect(context.keyword).toBe("from");
   });

   test("BREAK THE PARSER: should handle window functions correctly", () => {
      // The engine will see 'OVER (' and incorrectly create a 'fn' context.
      // The keyword for a column inside PARTITION BY should be 'partition by', not 'fn'.
      context.next("select row_number() over (partition by");
      expect(context.keyword).toBe("partition by");
      context.next("order by created_at)");
      expect(context.keyword).toBe("select");
   });

   test("BREAK THE LEXER: should ignore parentheses inside dollar-quoted strings (PostgreSQL)", () => {
      // This will break the parenthesis counter, leading to incorrect context popping.
      context.next("select $$ a string with ( and ) in it $$ as my_string");
      context.next(", max("); // This will push a new 'fn' context
      expect(context.keyword).toBe("fn");
      context.next("a)"); // This will pop... but which context? The dollar-quoting will have confused the depth count.
      expect(context.keyword).toBe("select");
   });

   test("BREAK THE LEXER: should handle complex operators without breaking", () => {
      // This tests the tokenizer's robustness against non-standard operators.
      context.next("select data ->> 'name' from events where");
      expect(context.keyword).toBe("where");
   });

   test("should not find coalesce( as function keyword", () => {
      context.next(`outer apply (select coalesce((`);
      expect(context.keyword).toBe("fn");
   });
});

import { beforeEach, describe, expect, test } from "vitest";
import { SqlQueryContext } from "../sql-query-context.js";

describe("Advanced QueryContext Engine Stress Tests", () => {
   let context!: SqlQueryContext;

   beforeEach(() => {
      context = new SqlQueryContext({ queryName: "test" });
   });

   test("BREAK THE PARSER: should not create a new context for simple expression grouping", () => {
      // This tests the assumption that '(' always means a subquery or function.
      // Here, it's just for precedence. The context should remain 'where'.
      context.next("select * from users where (");
      context.next("name = 'a' or");
      expect(context.keyword).toBe("where"); // <-- This will likely fail and be 'fn'
      context.next("email = 'b' ) and status = 1");
      expect(context.keyword).toBe("where");
   });

   test("BREAK THE PARSER: should correctly identify a subquery with leading comments", () => {
      // This tests the naive "peek-ahead" logic. A comment between '(' and 'select'
      // will fool the current engine into thinking this is a function call.
      context.next("select * from ( -- a subquery\n select id from users");
      expect(context.keyword).toBe("from"); // <-- This will likely fail and be 'fn'
      context.next(") as u");
      expect(context.keyword).toBe("from");
   });

   test("BREAK THE PARSER: should handle window functions correctly", () => {
      // The engine will see 'OVER (' and incorrectly create a 'fn' context.
      // The keyword for a column inside PARTITION BY should be 'partition by', not 'fn'.
      context.next("select row_number() over (partition by");
      // We need a new MAJOR_KEYWORD for this to pass, but first, let's watch it fail.
      expect(context.keyword).toBe("partition by"); // <-- This will fail and be 'fn'
      context.next("order by created_at)");
      expect(context.keyword).toBe("select");
   });

   test("BREAK THE PARSER: should ignore parentheses inside dollar-quoted strings (PostgreSQL)", () => {
      // This will break the parenthesis counter, leading to incorrect context popping.
      context.next("select $$ a string with ( and ) in it $$ as my_string");
      context.next(", max("); // This will push a new 'fn' context
      expect(context.keyword).toBe("fn");
      context.next("a)"); // This will pop... but which context? The dollar-quoting will have confused the depth count.
      expect(context.keyword).toBe("select"); // <-- This will likely fail.
   });

   test("BREAK THE PARSER: should handle complex operators without breaking", () => {
      // This tests the tokenizer's robustness against non-standard operators.
      context.next("select data ->> 'name' from events where");
      expect(context.keyword).toBe("where"); // <-- This might pass, but it stresses the regex.
   });
});

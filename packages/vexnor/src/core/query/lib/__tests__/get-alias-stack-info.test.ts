import { describe, expect, test } from "vitest";
import { getAliasStackInfo } from "#/core/query/lib/get-alias-stack-info.js";

describe("getAliasStackInfo", () => {
   test("returns <none> for undefined stack", () => {
      expect(getAliasStackInfo(undefined as never)).toMatchInlineSnapshot(`"<none>"`);
   });

   test("returns formatted stack info for single entry", () => {
      const stack = new Map<string, string>([
         ["$queryId", "q1"],
         ["public.account", "a_1"],
      ]);
      expect(getAliasStackInfo([stack])).toMatchInlineSnapshot(`
        "
        <stack>
        0:
           $queryId => q1
           public.account => a_1
        </stack>"
      `);
   });

   test("returns formatted stack info for multiple entries", () => {
      const stack1 = new Map<string, string>([
         ["$queryId", "q1"],
         ["public.account", "a_1"],
      ]);
      const stack2 = new Map<string, string>([
         ["$queryId", "q2"],
         ["public.order", "o_1"],
      ]);
      expect(getAliasStackInfo([stack1, stack2])).toMatchInlineSnapshot(`
        "
        <stack>
        0:
           $queryId => q1
           public.account => a_1
        1:
           $queryId => q2
           public.order => o_1
        </stack>"
      `);
   });
});

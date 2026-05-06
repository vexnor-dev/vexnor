import { describe, expect, it } from "vitest";
import { trim } from "#/core/utils/trim.js";

describe("queryMatcher() suite", () => {
   it("queryMatcher() should remove new lines", () => {
      const actual = trim(`
      hello
      world`);
      expect(actual).toBe(`hello world`);
   });
});

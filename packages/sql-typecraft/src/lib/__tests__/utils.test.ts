import { describe, expect, it } from "vitest";
import { trim } from "./utils.js";

describe("trim() suite", () => {
   it("trim() should remove new lines", () => {
      const actual = trim(`
      hello
      world`);
      expect(actual).toBe(`hello world`);
   });
});

import { describe, expect, test } from "vitest";
import { parseNumberOption } from "#src/cli/parse-number-option.js";

describe("parseNumberOption", () => {
   test("ignores Commander's previous option value argument", () => {
      expect(Reflect.apply(parseNumberOption, undefined, ["2", 100])).toMatchInlineSnapshot(`2`);
   });
});

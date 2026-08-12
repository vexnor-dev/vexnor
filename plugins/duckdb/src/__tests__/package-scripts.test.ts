import { describe, expect, it } from "vitest";

import pkg from "../../package.json" with { type: "json" };

describe("package scripts", () => {
   it("uses a cross-platform pretest command", () => {
      expect(pkg.scripts.pretest).toMatchInlineSnapshot(`"run-s build"`);
   });
});

import { describe, expect, it } from "vitest";

import pkg from "../package.json" with { type: "json" };

describe("package scripts", () => {
   it("uses cross-platform lifecycle commands", () => {
      expect({ prebuild: pkg.scripts.prebuild, pretest: pkg.scripts.pretest }).toMatchInlineSnapshot(`
        {
          "prebuild": "run-s build:dependencies prepare-db codegen:vexnor",
          "pretest": "run-s build",
        }
      `);
   });
});

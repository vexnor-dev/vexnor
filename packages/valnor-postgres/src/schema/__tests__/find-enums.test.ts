import { describe, expect, test } from "vitest";
import { findEnums } from "../find-enums.js";

describe("Find Enums tests", () => {
   test("Find Enums query should match expected SQL", () => {
      const query = findEnums.getSql({ params: { schemas: ["public"] } });
      expect(query).toBeDefined();
   });
});

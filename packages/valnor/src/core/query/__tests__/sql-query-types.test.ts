import { describe, expect, test } from "vitest";
import { SqlRunArgs } from "../sql-query-types.js";

describe("SqlQueryTypes Inference tests", () => {
   test("SqlRunArgs should include params", () => {
      type Target = SqlRunArgs<"Connection", { name: string }>;
      const target: Target = {
         db: "Connection",
         params: { name: "test" },
      };
      expect(target).toBeDefined();
      expect(target.params.name).toBe("test");
      expect(target.db).toBe("Connection");
      expect(target.params).toEqual({ name: "test" });
      //@ts-expect-error not defined
      expect(target.params.address).toBeUndefined();
   });

   test("SqlRunArgs should not include params when Params is never)", () => {
      type Target = SqlRunArgs<"Connection", undefined>;
      const target: Target = {
         db: "Connection",
      };
      expect(target).toBeDefined();
      //@ts-expect-error not defined
      expect(target.params).toBeUndefined();
      expect(target.db).toBe("Connection");
   });
});

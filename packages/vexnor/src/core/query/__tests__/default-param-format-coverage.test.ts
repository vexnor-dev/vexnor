import { describe, expect, test } from "vitest";
import { getDefaultParamFormat } from "#/core/query/default-param-format.js";

describe("getDefaultParamFormat — all dialects", () => {
   test("postgresql format uses $N", () => {
      const format = getDefaultParamFormat("postgresql");
      expect(format({ index: 0 })).toMatchInlineSnapshot(`"$1"`);
      expect(format({ index: 4 })).toMatchInlineSnapshot(`"$5"`);
   });

   test("transactsql format uses @param_N", () => {
      const format = getDefaultParamFormat("transactsql");
      expect(format({ index: 0 })).toMatchInlineSnapshot(`"@param_0"`);
      expect(format({ index: 3 })).toMatchInlineSnapshot(`"@param_3"`);
   });

   test("tsql format uses @param_N", () => {
      const format = getDefaultParamFormat("tsql");
      expect(format({ index: 0 })).toMatchInlineSnapshot(`"@param_0"`);
   });

   test("unknown dialect falls back to ?", () => {
      const format = getDefaultParamFormat("sqlite");
      expect(format({ index: 0 })).toMatchInlineSnapshot(`"?"`);
      expect(format({ index: 5, name: "test" })).toMatchInlineSnapshot(`"?"`);
   });

   test("sql dialect falls back to ?", () => {
      const format = getDefaultParamFormat("sql");
      expect(format({ index: 0 })).toMatchInlineSnapshot(`"?"`);
   });
});

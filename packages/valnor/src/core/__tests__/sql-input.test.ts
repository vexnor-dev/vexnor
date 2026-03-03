import { assertType, describe, expect, test } from "vitest";
import { input, param, SqlParam, SqlInputParams } from "../query/index.js";

describe("SqlInput<{}> tests", () => {
   test("should generate params on the fly", () => {
      const params = input<{ id: number; name: string }>();
      expect(params.$id).toMatchObject({
         name: "id",
      });
      expect(params.$id).toBeInstanceOf(SqlParam);

      expect(params.$name).toMatchObject({
         name: "name",
      });
      expect(params.$name).toBeInstanceOf(SqlParam);
   });

   test("should match SqlParameter<{}>", () => {
      assertType<SqlInputParams<{ Params: { id: number; name: string } }>>({
         $id: param<{ id: number }>("id"),
         $name: param<{ name: string }>("name"),
      });
   });
});

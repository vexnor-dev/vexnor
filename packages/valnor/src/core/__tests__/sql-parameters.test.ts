import { assertType, describe, expect, test } from "vitest";
import { newSqlParameters, param, SqlParam, SqlParameters } from "../query/index.js";

describe("SqlParameters<{}> tests", () => {
   test("should generate params on the fly", () => {
      const params = newSqlParameters<{ id: number; name: string }>();
      expect(params.id).toMatchObject({
         name: "id",
      });
      expect(params.id).toBeInstanceOf(SqlParam);

      expect(params.name).toMatchObject({
         name: "name",
      });
      expect(params.name).toBeInstanceOf(SqlParam);
   });

   test("should match SqlParameter<{}>", () => {
      type Actual = SqlParameters<{ id: number; name: string }>;
      assertType<Actual>({ id: param<{ id: number }>("id"), name: param<{ name: string }>("name") });
   });
});

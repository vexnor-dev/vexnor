import { describe, expect, test } from "vitest";
import { sql } from "#src/core/sql.js";

describe("SqlQuery.label (initLabel)", () => {
   test("primitive string value appears in label", () => {
      const query = sql`select ${"hello"} from t`;
      expect(query.label).toMatchInlineSnapshot(`"SqlQuery#1: select  hello  from t"`);
   });

   test("numeric zero appears in label (falsy primitive)", () => {
      const query = sql`select ${0} from t`;
      expect(query.label).toMatchInlineSnapshot(`"SqlQuery#1: select  0  from t"`);
   });

   test("boolean false appears in label (falsy primitive)", () => {
      const query = sql`select ${false} from t`;
      expect(query.label).toMatchInlineSnapshot(`"SqlQuery#1: select  false  from t"`);
   });
});

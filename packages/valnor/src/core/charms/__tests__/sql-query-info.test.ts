import { describe, expect, test } from "vitest";
import { sql } from "../../sql.js";
import { info } from "../sql-query-info.js";

describe("SqlQueryInfo tests", () => {
   test("query should have info label", () => {
      const query = sql`
            ${info({ label: "test1" })}`;
      expect(query.info).toMatchObject({
         label: "test1",
      });
   });
});

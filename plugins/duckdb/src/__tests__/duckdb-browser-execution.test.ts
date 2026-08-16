import { describe, expect, it } from "vitest";

import { executeDuckDBQuery } from "../duckdb-execution.browser.js";

describe("DuckDB browser execution", () => {
   it("rejects local DuckDB execution in a browser build", async () => {
      await expect(executeDuckDBQuery()).rejects.toThrowErrorMatchingInlineSnapshot(`[Error: Local DuckDB execution is unavailable in browser builds; use a remote client]`);
   });
});

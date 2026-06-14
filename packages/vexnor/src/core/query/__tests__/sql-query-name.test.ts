import { describe, expect, test } from "vitest";
import { getQueryName } from "#/core/query/sql-query-name.js";

const fixtureUrl = new URL("./fixtures/query-name-exports.mjs", import.meta.url).href;

describe("getQueryName — module export name resolution", () => {
   test("resolves variable name for exported SqlQuery", async () => {
      const { randomQuery } = await import(fixtureUrl);
      randomQuery.locationUrl = fixtureUrl;
      expect(await getQueryName(randomQuery)).toBe("randomQuery");
   });

   test("resolves variable name for exported SqlQueryHandler", async () => {
      const { randomHandler } = await import(fixtureUrl);
      randomHandler.source.locationUrl = fixtureUrl;
      expect(await getQueryName(randomHandler.source)).toBe("randomHandler");
   });
});

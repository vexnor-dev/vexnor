import { describe, expect, test } from "vitest";
import { type DuckDBConnectionConfig, resolveDuckDBConnectionConfig } from "#src/duckdb-connection-config.js";

describe("resolveDuckDBConnectionConfig", () => {
   test("resolves every supported connection mode", () => {
      const configs: DuckDBConnectionConfig[] = [
         { mode: "memory" },
         { mode: "file", path: "analytics.db" },
         { mode: "motherduck", database: "analytics", token: "secret token" },
         { uri: ":memory:" },
         { uri: "local.db" },
         { uri: "md:analytics?motherduck_token=secret" },
      ];
      expect(configs.map(resolveDuckDBConnectionConfig)).toMatchInlineSnapshot(`
        [
          {
            "cache": false,
            "path": ":memory:",
          },
          {
            "cache": true,
            "path": "analytics.db",
          },
          {
            "cache": true,
            "path": "md:analytics?motherduck_token=secret%20token",
          },
          {
            "cache": false,
            "path": ":memory:",
          },
          {
            "cache": true,
            "path": "local.db",
          },
          {
            "cache": true,
            "path": "md:analytics?motherduck_token=secret",
          },
        ]
      `);
   });

   test("rejects every empty required value", () => {
      const configs: DuckDBConnectionConfig[] = [
         { mode: "file", path: "" },
         { mode: "motherduck", database: "", token: "token" },
         { mode: "motherduck", database: "db", token: "" },
         { uri: "" },
      ];
      const messages = configs.map((config) => {
         try {
            resolveDuckDBConnectionConfig(config);
            return "no error";
         } catch (error) {
            return error instanceof Error ? error.message : String(error);
         }
      });
      expect(messages).toMatchInlineSnapshot(`
        [
          "DuckDB file path must be a non-empty string",
          "MotherDuck database must be a non-empty string",
          "MotherDuck token must be a non-empty string",
          "DuckDB uri must be a non-empty string",
        ]
      `);
   });
});

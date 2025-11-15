import "../../cli/exec/__tests__/test-driver-setup.js";
import { describe, expect, test } from "vitest";
import { defineQueryConfig } from "../define-query-config.js";
import { defineConfig } from "../define-config.js";
import { findAccountById, findAccountByEmail } from "./test-queries.js";

describe("defineQueryConfig", () => {
   test("validates config has queries", () => {
      // @ts-expect-error - Testing runtime validation of empty queries
      expect(() => defineQueryConfig({ findAccountById })({ queries: {} })).toThrow(
         "Query config must have at least one query",
      );
   });

   test("returns valid config with single query", () => {
      const config = defineQueryConfig({ findAccountById })({
         queries: {
            findAccountById: {
               profile: "postgres",
               params: { accountId: 1, email: "test@example.com" },
            },
         },
      });

      expect(config.queries.findAccountById?.profile).toBe("postgres");
      expect(config.queries.findAccountById?.params).toEqual({ accountId: 1, email: "test@example.com" });
   });

   test("returns valid config with multiple queries", () => {
      const config = defineQueryConfig({ findAccountById, findAccountByEmail })({
         queries: {
            findAccountById: {
               profile: "postgres",
               params: { accountId: 1, email: "test@example.com" },
            },
            findAccountByEmail: {
               profile: "postgres",
               params: { email: "test@example.com" },
            },
         },
      });

      expect(Object.keys(config.queries)).toHaveLength(2);
      expect(config.queries.findAccountById?.profile).toBe("postgres");
      expect(config.queries.findAccountByEmail?.profile).toBe("postgres");
   });

   test("attaches query to settings", () => {
      const config = defineQueryConfig({ findAccountById })({
         queries: {
            findAccountById: {
               profile: "postgres",
               params: { accountId: 1, email: "test@example.com" },
            },
         },
      });

      expect(config.queries.findAccountById?.query).toBe(findAccountById);
   });

   test("preserves defaults", () => {
      const config = defineQueryConfig({ findAccountById })({
         queries: {
            findAccountById: {
               profile: "postgres",
               params: { accountId: 1, email: "test@example.com" },
            },
         },
         defaults: {
            profile: "postgres",
            format: "json",
            limit: 50,
         },
      });

      expect(config.defaults?.profile).toBe("postgres");
      expect(config.defaults?.format).toBe("json");
      expect(config.defaults?.limit).toBe(50);
   });

   test("preserves query-specific format and limit", () => {
      const config = defineQueryConfig({ findAccountById })({
         queries: {
            findAccountById: {
               profile: "postgres",
               params: { accountId: 1, email: "test@example.com" },
               format: "csv",
               limit: 10,
            },
         },
      });

      expect(config.queries.findAccountById?.format).toBe("csv");
      expect(config.queries.findAccountById?.limit).toBe(10);
   });

   test("accepts direct ProfileConfig reference", () => {
      const rootConfig = defineConfig({
         profiles: {
            postgres: {
               plugin: "valnor-postgres",
               connection: { uri: "postgres://localhost" },
               generate: { schema: ["public"], outDir: "./out" },
            },
         },
      });

      const config = defineQueryConfig({ findAccountById })({
         queries: {
            findAccountById: {
               profile: rootConfig.profiles.postgres,
               params: { accountId: 1, email: "test@example.com" },
            },
         },
      });

      expect(config.queries.findAccountById?.profile).toBe(rootConfig.profiles.postgres);
   });

   test("infers params type from SqlQuery", () => {
      const config = defineQueryConfig({ findAccountById })({
         queries: {
            findAccountById: {
               profile: "postgres",
               params: { accountId: 1, email: "test@example.com" },
            },
         },
      });

      expect(config.queries.findAccountById?.query).toBe(findAccountById);
      expect(config.queries.findAccountById?.params).toEqual({ accountId: 1, email: "test@example.com" });
   });

   test("validates config queries keys match provided queries - missing query in config", () => {
      expect(() =>
         defineQueryConfig({ findAccountById, findAccountByEmail })({
            // @ts-expect-error - Testing runtime validation of missing query in config
            queries: {
               findAccountById: {
                  profile: "postgres",
                  params: { accountId: 1, email: "test@example.com" },
               },
            },
         }),
      ).toThrow("Config queries mismatch. Expected: [findAccountByEmail, findAccountById], got: [findAccountById]");
   });

   test("validates config queries keys match provided queries - extra query in config", () => {
      expect(() =>
         defineQueryConfig({ findAccountById })({
            queries: {
               findAccountById: {
                  profile: "postgres",
                  params: { accountId: 1, email: "test@example.com" },
               },
               unknownQuery: {
                  profile: "postgres",
                  params: {},
               },
            },
         }),
      ).toThrow("Config queries mismatch. Expected: [findAccountById], got: [findAccountById, unknownQuery]");
   });

   test("validates missing profile", () => {
      expect(() =>
         defineQueryConfig({ findAccountById })({
            queries: {
               // @ts-expect-error - Testing runtime validation of missing profile
               findAccountById: {
                  params: { accountId: 1, email: "test@example.com" },
               },
            },
         }),
      ).toThrow("Query 'findAccountById' missing profile");
   });

   test("validates missing params", () => {
      expect(() =>
         defineQueryConfig({ findAccountById })({
            queries: {
               // @ts-expect-error - Testing runtime validation of missing params
               findAccountById: {
                  profile: "postgres",
               },
            },
         }),
      ).toThrow("Query 'findAccountById' missing params");
   });

   test("validates params mismatch - missing param", () => {
      expect(() =>
         defineQueryConfig({ findAccountById })({
            queries: {
               findAccountById: {
                  profile: "postgres",
                  params: { accountId: 1 } as any,
               },
            },
         }),
      ).toThrow("Query 'findAccountById' params mismatch. Expected: [accountId, email], got: [accountId]");
   });

   test("validates params mismatch - extra param", () => {
      expect(() =>
         defineQueryConfig({ findAccountById })({
            queries: {
               findAccountById: {
                  profile: "postgres",
                  params: { accountId: 1, email: "test@example.com", extra: "value" },
               },
            },
         }),
      ).toThrow(
         "Query 'findAccountById' params mismatch. Expected: [accountId, email], got: [accountId, email, extra]",
      );
   });
});

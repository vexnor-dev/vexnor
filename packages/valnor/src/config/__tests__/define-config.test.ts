import { describe, expect, test } from "vitest";
import { defineConfig } from "../define-config.js";

describe("defineConfig", () => {
   test("validates config has profiles", () => {
      expect(() => defineConfig({ profiles: {} })).toThrow("Config must have at least one profile");
   });

   test("validates profile has plugin", () => {
      expect(() =>
         defineConfig({
            profiles: {
               postgres: {
                  connection: { uri: "postgres://localhost" },
                  generate: { schema: ["public"], outDir: "./out" },
               },
            },
         }),
      ).toThrow("Profile 'postgres' missing plugin");
   });

   test("validates profile has connection", () => {
      expect(() =>
         defineConfig({
            profiles: {
               // @ts-expect-error - Testing runtime validation of missing connection
               postgres: {
                  generate: { schema: ["public"], outDir: "./out" },
               },
            },
         }),
      ).toThrow("Profile 'postgres' missing connection");
   });

   test("validates profile has generate config", () => {
      expect(() =>
         defineConfig({
            profiles: {
               postgres: {
                  plugin: "valnor-postgres",
                  connection: { uri: "postgres://localhost" },
               },
            },
         }),
      ).toThrow("Profile 'postgres' missing generate config");
   });

   test("validates all profiles", () => {
      expect(() =>
         defineConfig({
            profiles: {
               postgres: {
                  plugin: "valnor-postgres",
                  connection: { uri: "postgres://localhost" },
                  generate: { schema: ["public"], outDir: "./out" },
               },
               mysql: {
                  connection: { uri: "mysql://localhost" },
                  generate: { schema: ["public"], outDir: "./out" },
               },
            },
         }),
      ).toThrow("Profile 'mysql' missing plugin");
   });

   test("returns valid config with single profile", () => {
      const config = defineConfig({
         profiles: {
            postgres: {
               plugin: "valnor-postgres",
               connection: { uri: "postgres://localhost" },
               generate: { schema: ["public"], outDir: "./out" },
            },
         },
      });

      expect(config.profiles.postgres?.plugin).toBe("valnor-postgres");
      expect(config.profiles.postgres?.connection.uri).toBe("postgres://localhost");
      expect(config.profiles.postgres?.generate.schema).toEqual(["public"]);
   });

   test("returns valid config with multiple profiles", () => {
      const config = defineConfig({
         profiles: {
            postgres: {
               plugin: "valnor-postgres",
               connection: { host: "localhost", port: 5432, database: "test", user: "user", password: "pass" },
               generate: { schema: ["public"], outDir: "./out" },
            },
            mysql: {
               plugin: "valnor-mysql",
               connection: { host: "localhost", port: 3306, database: "test", user: "user", password: "pass" },
               generate: { schema: ["public"], outDir: "./out" },
            },
         },
      });

      expect(Object.keys(config.profiles)).toHaveLength(2);
      expect(config.profiles.postgres?.plugin).toBe("valnor-postgres");
      expect(config.profiles.mysql?.plugin).toBe("valnor-mysql");
   });

   test("preserves optional fields", () => {
      const result = defineConfig({
         profiles: {
            postgres: {
               connection: { uri: "postgres://localhost" },
               generate: { schema: ["public"], outDir: "./out", pascalCaseTables: true, camelCaseColumns: true },
            },
         },
         defaultProfile: "postgres",
         exec: {
            format: "json",
            limit: 100,
            confirmMutations: true,
            dryRun: false,
         },
      });

      expect(result.defaultProfile).toBe("postgres");
      expect(result.exec?.format).toBe("json");
      expect(result.exec?.limit).toBe(100);
      expect(result.profiles.postgres?.generate.pascalCaseTables).toBe(true);
      expect(result.profiles.postgres?.generate.camelCaseColumns).toBe(true);
   });
});

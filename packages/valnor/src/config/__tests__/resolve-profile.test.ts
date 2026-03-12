import { describe, expect, test } from "vitest";
import { resolveProfile } from "#/config/resolve-profile.js";
import { ValnorConfig } from "#/config/config-types.js";

describe("resolveProfile", () => {
   const config: ValnorConfig = {
      profiles: {
         postgres: {
            connection: { uri: "postgres://localhost" },
            generate: { schema: ["public"], outDir: "./out" },
         },
         mysql: {
            connection: { uri: "mysql://localhost" },
            generate: { schema: ["public"], outDir: "./out" },
         },
      },
   };

   test("returns undefined for undefined profile", () => {
      expect(resolveProfile(undefined, config)).toBeUndefined();
   });

   test("returns string profile as-is", () => {
      expect(resolveProfile("postgres", config)).toBe("postgres");
   });

   test("resolves ProfileConfig to key name", () => {
      expect(resolveProfile(config.profiles.postgres, config)).toBe("postgres");
      expect(resolveProfile(config.profiles.mysql, config)).toBe("mysql");
   });

   test("throws for ProfileConfig not in config", () => {
      const orphanProfile = {
         plugin: "valnor-postgres",
         connection: { uri: "postgres://localhost" },
         generate: { schema: ["public"], outDir: "./out" },
      };
      expect(() => resolveProfile(orphanProfile, config)).toThrow("Profile not found in config");
   });
});

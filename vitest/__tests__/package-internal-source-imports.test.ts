import path from "node:path";

import { describe, expect, test } from "vitest";

import {
   packageInternalSourceImports,
   resolvePackageInternalSourceImport,
} from "../package-internal-source-imports.js";

const repositoryRoot = path.resolve(import.meta.dirname, "../..");
const sourceRoots = [
   path.join(repositoryRoot, "packages/core/src"),
   path.join(repositoryRoot, "plugins/mssql/src"),
   path.join(repositoryRoot, "plugins/postgres/src"),
   path.join(repositoryRoot, "plugins/sqlite3/src"),
];

describe("resolvePackageInternalSourceImport", () => {
   test("creates a package-bounded pre-resolution plugin", async () => {
      const sourceRoot = path.join(repositoryRoot, "plugins/mssql/src");
      const plugin = packageInternalSourceImports(sourceRoot);
      const resolveId = plugin.resolveId;
      if (typeof resolveId !== "function") throw new Error("Expected a resolveId hook");

      expect({
         enforce: plugin.enforce,
         ignored: await Reflect.apply(resolveId, undefined, [
            "node:path",
            path.join(sourceRoot, "vexnor-mssql.ts"),
         ]),
         name: plugin.name,
         resolved: normalize(
            await Reflect.apply(resolveId, undefined, [
               "#src/vexnor-mssql.js",
               path.join(sourceRoot, "vexnor-mssql.ts"),
            ]),
         ),
      }).toMatchInlineSnapshot(`
        {
          "enforce": "pre",
          "ignored": null,
          "name": "package-internal-source-imports",
          "resolved": "<repository>/plugins/mssql/src/vexnor-mssql.ts",
        }
      `);
   });

   test("resolves JavaScript runtime specifiers to TypeScript in the owning package", () => {
      expect({
         core: normalize(
            resolvePackageInternalSourceImport(
               "#src/core/sql.js",
               path.join(repositoryRoot, "packages/core/src/core/__tests__/sql.test.ts"),
               sourceRoots,
            ),
         ),
         mssql: normalize(
            resolvePackageInternalSourceImport(
               "#src/vexnor-mssql.js",
               path.join(repositoryRoot, "plugins/mssql/src/__tests__/vexnor-mssql-plugin.test.ts"),
               sourceRoots,
            ),
         ),
         postgres: normalize(
            resolvePackageInternalSourceImport(
               "#src/vexnor-postgres.js",
               path.join(repositoryRoot, "plugins/postgres/src/__tests__/vexnor-postgres-plugin.test.ts"),
               sourceRoots,
            ),
         ),
         sqlite3: normalize(
            resolvePackageInternalSourceImport(
               "#src/vexnor-sqlite3.js",
               path.join(repositoryRoot, "plugins/sqlite3/src/__tests__/vexnor-sqlite3-plugin.test.ts"),
               sourceRoots,
            ),
         ),
      }).toMatchInlineSnapshot(`
        {
          "core": "<repository>/packages/core/src/core/sql.ts",
          "mssql": "<repository>/plugins/mssql/src/vexnor-mssql.ts",
          "postgres": "<repository>/plugins/postgres/src/vexnor-postgres.ts",
          "sqlite3": "<repository>/plugins/sqlite3/src/vexnor-sqlite3.ts",
        }
      `);
   });

   test("resolves extensionless directory entrypoints", () => {
      expect(
         normalize(
            resolvePackageInternalSourceImport(
               "#src/format",
               path.join(repositoryRoot, "packages/core/src/core/__tests__/sql.test.ts"),
               sourceRoots,
            ),
         ),
      ).toMatchInlineSnapshot(`"<repository>/packages/core/src/format/index.ts"`);
   });

   test("resolves built imports from the owning package without hijacking dependencies", () => {
      const builtPackage = resolvePackageInternalSourceImport(
         "#src/core/sql.js",
         path.join(repositoryRoot, "packages/core/dist/execution/sql-query-registry.js"),
         sourceRoots,
      );
      if (!builtPackage) throw new Error("Expected the owning package's built import to resolve to source");

      expect({
         builtPackage: normalize(builtPackage),
         dependency: resolvePackageInternalSourceImport(
            "#src/core/sql.js",
            path.join(repositoryRoot, "packages/core/node_modules/example/dist/index.js"),
            sourceRoots,
         ),
         siblingPackage: resolvePackageInternalSourceImport(
            "#src/core/sql.js",
            path.join(repositoryRoot, "packages/orm/dist/index.js"),
            sourceRoots,
         ),
      }).toMatchInlineSnapshot(`
        {
          "builtPackage": "<repository>/packages/core/src/core/sql.ts",
          "dependency": null,
          "siblingPackage": null,
        }
      `);
   });

   test("does not resolve another package, missing files, or escaping paths", () => {
      const importer = path.join(repositoryRoot, "plugins/mssql/src/vexnor-mssql.ts?test-query");

      expect({
         anotherPackage: resolvePackageInternalSourceImport("#src/vexnor-postgres.js", importer, sourceRoots),
         anonymous: resolvePackageInternalSourceImport("#src/vexnor-mssql.js", undefined, sourceRoots),
         escaping: resolvePackageInternalSourceImport("#src/../../../package.json", importer, sourceRoots),
         missing: resolvePackageInternalSourceImport("#src/missing.js", importer, sourceRoots),
      }).toMatchInlineSnapshot(`
        {
          "anonymous": null,
          "anotherPackage": null,
          "escaping": null,
          "missing": null,
        }
      `);
   });
});

function normalize(value: string | null): string | null {
   return value?.replace(repositoryRoot, "<repository>").replaceAll("\\", "/") ?? null;
}

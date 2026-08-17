import fs from "node:fs";
import path from "node:path";

import type { Plugin } from "vitest/config";

const internalSourcePrefix = "#src/";
const sourceFileSuffixes = [".ts", ".tsx", "/index.ts", "/index.tsx"];

/**
 * Resolves a package's own internal imports to TypeScript source during tests.
 * Imports from that package's source and built output resolve to source, while
 * dependencies keep their published import-map resolution even when multiple
 * packages use the same `#src/*` specifier.
 */
export function packageInternalSourceImports(sourceRoot: string): Plugin {
   const absoluteSourceRoot = path.resolve(sourceRoot);

   return {
      name: "package-internal-source-imports",
      enforce: "pre",
      resolveId(source, importer) {
         return resolvePackageInternalSourceImport(source, importer, [absoluteSourceRoot]);
      },
   };
}

export function resolvePackageInternalSourceImport(
   source: string,
   importer: string | undefined,
   sourceRoots: readonly string[],
): string | null {
   if (!importer || !source.startsWith(internalSourcePrefix)) return null;

   const queryIndex = importer.indexOf("?");
   const importerPath = queryIndex === -1 ? importer : importer.slice(0, queryIndex);
   const sourceRoot = sourceRoots.find((candidate) => isPackageImporter(candidate, importerPath));
   if (!sourceRoot) return null;

   const internalPath = source.slice(internalSourcePrefix.length);
   const sourcePath = internalPath.endsWith(".js") ? internalPath.slice(0, -3) : internalPath;
   const base = path.resolve(sourceRoot, sourcePath);
   if (!isPathWithin(sourceRoot, base)) return null;

   for (const suffix of sourceFileSuffixes) {
      const candidate = `${base}${suffix}`;
      if (fs.existsSync(candidate) && fs.statSync(candidate).isFile()) return candidate;
   }

   return null;
}

function isPackageImporter(sourceRoot: string, importerPath: string): boolean {
   const packageRoot = path.dirname(sourceRoot);
   if (!isPathWithin(packageRoot, importerPath)) return false;

   return !path.relative(packageRoot, importerPath).split(path.sep).includes("node_modules");
}

function isPathWithin(parent: string, candidate: string): boolean {
   const relativePath = path.relative(parent, candidate);
   return (
      relativePath === "" ||
      (relativePath !== ".." && !relativePath.startsWith(`..${path.sep}`) && !path.isAbsolute(relativePath))
   );
}

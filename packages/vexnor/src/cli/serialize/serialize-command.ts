import * as path from "node:path";
import * as fs from "node:fs";
import { glob } from "node:fs/promises";
import { SqlQuery } from "#/core/query/sql-query.js";
import { SqlQueryHandler } from "#/core/query/sql-query-handler.js";
import { serializeManifest } from "#/core/serialize/serialize-query.js";
import type { SqlQueryAny } from "#/core/query/sql-query.js";

export interface SerializeOptions {
   /** Path to the file(s) exporting queries (glob supported). */
   input: string;
   /** Output directory for the manifest JSON files (one per source file). */
   output: string;
   /** SQL dialect (postgresql, transactsql, sqlite). */
   dialect: string;
}

export async function serializeCommand(options: SerializeOptions): Promise<void> {
   const { input, output, dialect } = options;

   const files = await Array.fromAsync(
      glob(input, {
         cwd: process.cwd(),
         exclude: (f) => f === "node_modules" || f === "dist" || f === "build",
      }),
      (f) => path.resolve(process.cwd(), f),
   );

   if (files.length === 0) {
      throw new Error(`No files found matching: ${input}`);
   }

   const outputDir = path.resolve(process.cwd(), output);
   fs.mkdirSync(outputDir, { recursive: true });

   let totalQueries = 0;

   for (const file of files) {
      const module = await import(file);
      const queries: Array<{ query: SqlQueryAny; name: string; hash: string }> = [];

      for (const [name, value] of Object.entries(module)) {
         const query = extractQuery(value);
         if (query) {
            queries.push({ query, name, hash: await query.hash });
         }
      }

      if (queries.length === 0) continue;

      const manifest = await serializeManifest(queries, dialect);

      // Preserve relative path structure: src/queries/accounts.ts → queries/accounts.json
      const relativePath = path.relative(process.cwd(), file);
      const parsed = path.parse(relativePath);
      const outputPath = path.join(outputDir, parsed.dir, `${parsed.name}.json`);
      fs.mkdirSync(path.dirname(outputPath), { recursive: true });
      fs.writeFileSync(outputPath, JSON.stringify(manifest, null, 2));

      totalQueries += queries.length;
      console.log(`  ${relativePath} → ${path.relative(outputDir, outputPath)} (${queries.length} queries)`);
   }

   console.log(`\nSerialized ${totalQueries} queries from ${files.length} files to ${path.relative(process.cwd(), outputDir)}/`);
}

function extractQuery(value: unknown): SqlQueryAny | null {
   if (value instanceof SqlQuery) return value;
   if (value instanceof SqlQueryHandler) return value.source;
   return null;
}

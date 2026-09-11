import { CodeWriter } from "#src/lib/code-writer.js";
import { SqlOutputFile } from "#src/plugin/plugin.js";

export function writeSchemaImports(writer: CodeWriter, files: SqlOutputFile[]) {
   // Sort by file name so the barrel is deterministic regardless of the order
   // the database returned the tables in, preventing spurious regeneration diffs.
   [...files]
      .sort((left, right) => left.fileName.localeCompare(right.fileName))
      .forEach(({ fileName }) => {
         writer.writeLine(`export * from "./${fileName}.js";`);
      });
}

import { CodeWriter } from "#/lib/code-writer.js";
import { SqlOutputFile } from "#/plugin/plugin.js";

export function writeSchemaImports(writer: CodeWriter, files: SqlOutputFile[]) {
   files.forEach(({ fileName }) => {
      writer.writeLine(`export * from "./${fileName}.js";`);
   });
   writer.blankLine();
}

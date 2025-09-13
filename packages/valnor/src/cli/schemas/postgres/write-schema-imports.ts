import CodeBlockWriter from "code-block-writer";
import { SqlOutputFile } from "../../types/index.js";

export function writeSchemaImports(writer: CodeBlockWriter.default, files: SqlOutputFile[]) {
   files.forEach(({ fileName, tableTypeName }) => {
      if (tableTypeName) {
         writer.writeLine(`export type * from "./${fileName}.js";`);
      } else {
         writer.writeLine(`export * from "./${fileName}.js";`);
      }
   });
   writer.blankLine();
}

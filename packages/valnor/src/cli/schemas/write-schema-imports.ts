import CodeBlockWriter from "code-block-writer";
import { SqlOutputFile } from "../../plugin/index.js";

export function writeSchemaImports(writer: CodeBlockWriter.default, files: SqlOutputFile[]) {
   files.forEach(({ fileName }) => {
      writer.writeLine(`export * from "./${fileName}.js";`);
   });
   writer.blankLine();
}

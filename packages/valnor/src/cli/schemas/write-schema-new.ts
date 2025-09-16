import { SqlOutputFile } from "../../plugin/index.js";
import to from "to-case";
import CodeBlockWriter from "code-block-writer";

export interface WriteSchemaNewArgs {
   schema: string;
   files: SqlOutputFile[];
}

export function writeSchemaNew(writer: CodeBlockWriter.default, { files }: WriteSchemaNewArgs) {
   // Write imports for each table file
   files.forEach((file) => {
      if (!file.tableTypeName) return;

      const tableName = file.moduleName;
      const pascalTableName = to.pascal(tableName);
      writer.writeLine(`import { ${pascalTableName} } from "./${file.fileName}.js";`);
   });
   writer.blankLine();
   return writer.toString();
}

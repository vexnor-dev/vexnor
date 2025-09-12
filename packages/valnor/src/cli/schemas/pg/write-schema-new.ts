import { SqlOutputFile } from "../../types/index.js";
import to from "to-case";
import CodeBlockWriter from "code-block-writer";

export interface WriteSchemaNewArgs {
   schema: string;
   files: SqlOutputFile[];
}

export function writeSchemaNew(writer: CodeBlockWriter.default, { schema, files }: WriteSchemaNewArgs) {
   // Write imports for each table file
   files.forEach((file) => {
      if (!file.tableTypeName) return;

      const tableName = file.moduleName;
      const pascalTableName = to.pascal(tableName);
      writer.writeLine(`import { ${pascalTableName} } from "./${file.fileName}.js";`);
   });
   writer.blankLine();

   // Write schema function
   writer.write(`export const ${to.pascal(schema)}Schema = `).inlineBlock(() => {
      files.forEach((file) => {
         if (!file.tableTypeName) return;

         const tableName = file.moduleName;
         const pascalTableName = to.pascal(tableName);

         // Add typed SQL instance
         writer.writeLine(`${pascalTableName},`);
      });
   });

   return writer.toString();
}

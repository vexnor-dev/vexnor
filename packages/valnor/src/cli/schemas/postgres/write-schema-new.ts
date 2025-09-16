import { SqlOutputFile } from "../../types/index.js";
import to from "to-case";
import CodeBlockWriter from "code-block-writer";

export interface WriteSchemaNewArgs {
   schema: string;
   files: SqlOutputFile[];
}

export function writeSchemaNew(writer: CodeBlockWriter.default, { schema, files }: WriteSchemaNewArgs) {
   // Write standard imports
   writer.writeLine(`import postgres from "postgres";`);
   writer.blankLine();

   // Write imports for each table file
   files.forEach((file) => {
      if (!file.tableTypeName) return;

      const tableName = file.moduleName;
      const pascalTableName = to.pascal(tableName);
      writer.writeLine(`import { new${pascalTableName} } from "./${file.fileName}.js";`);
   });
   writer.blankLine();

   // Write cli function
   writer.write(`export function new${to.pascal(schema)}Schema(sql: postgres.Sql)`).block(() => {
      writer.write(`return `).block(() => {
         files.forEach((file) => {
            if (!file.tableTypeName) return;

            const tableName = file.moduleName;
            const pascalTableName = to.pascal(tableName);

            // Add typed SQL instance
            writer.writeLine(`${pascalTableName}: new${pascalTableName}(sql),`);
         });
      });
   });

   return writer.toString();
}

import CodeBlockWriter from "code-block-writer";
import { PrintTableArgs } from "../../../plugin/index.js";
import { getCodegenContext } from "../codegen-context.js";

export function writeTableType(writer: CodeBlockWriter.default, { table }: PrintTableArgs) {
   const { getTableName, getColumnName } = getCodegenContext();
   const { table_name, table_columns, table_schema, primary_keys } = table;
   const tableTypeName = getTableName(table_name);
   const tableTypeSelect = `I${tableTypeName}Select`;
   const tableTypeInsert = `I${tableTypeName}Insert`;
   const tableTypeUpdate = `I${tableTypeName}Update`;

   writer
      .write(
         `export const ${tableTypeName} = valnor.newSqlTable<{ Select: ${tableTypeSelect}, Insert: ${tableTypeInsert}, Update: ${tableTypeUpdate} }>(`,
      )
      .inlineBlock(() => {
         writer.writeLine(`name: "${table_name}",`).writeLine(`schema: "${table_schema}",`);
         writer.writeLine(`pk: ["${primary_keys.map((pk) => getColumnName(pk)).join('","')}"], `);
         writer.writeLine(`columns:`).inlineBlock(() => {
            table_columns.forEach((col) => {
               const colAlias = getColumnName(col.column_name);
               writer.blankLine();
               writer
                  .writeLine(`/**`)
                  .write(` * ${col.column_name} ${col.udt_name}`)
                  .write(col.is_nullable ? "" : "not null")
                  .write(col.column_default ? ` default ${col.column_default}` : "")
                  .writeLine(`*/`)
                  .writeLine(`${colAlias}: "${col.column_name}",`);
            });
         });
      })
      .write(");");
}

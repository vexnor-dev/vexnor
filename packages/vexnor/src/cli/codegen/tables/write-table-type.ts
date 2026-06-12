import { CodeWriter } from "#/lib/code-writer.js";
import { PrintTableArgs, SqlLiteralType } from "#/plugin/plugin.js";
import { getCodegenContext } from "#/cli/codegen/codegen-context.js";

export function writeTableType(writer: CodeWriter, { table }: PrintTableArgs) {
   const { getTableName, getColumnName, plugin } = getCodegenContext();
   const { table_name, columns, table_schema, primary_keys, table_type } = table;
   const isView = table_type === "view";
   const tableTypeName = getTableName(table_name);
   const tableTypePrefix = `I${tableTypeName}`;
   const tableTypeSelect = `${tableTypePrefix}Select`;
   const tableTypeInsert = `${tableTypePrefix}Insert`;
   const tableTypeUpdate = `${tableTypePrefix}Update`;

   writer
      .write(`export const ${tableTypeName} = vexnor.newSqlTable`)
      .genericBlock(() => {
         writer.writeLine(`Select: ${tableTypeSelect};`);
         if (!isView) {
            writer.writeLine(`Insert: ${tableTypeInsert};`);
            writer.writeLine(`Update: ${tableTypeUpdate};`);
            writer.writeLine(`Delete: true;`);
         }
      })
      .write(`(`)
      .inlineBlock(() => {
         writer
            .write(`crud:`)
            .inlineBlock(() => {
               writer.writeLine(`select: true,`);
               writer.writeLine(`insert: ${!isView},`);
               writer.writeLine(`update: ${!isView},`);
               writer.writeLine(`delete: ${!isView},`);
            })
            .writeLine(",");
         writer
            .write("tableInfo:")
            .inlineBlock(() => {
               writer.writeLine(`name: "${table_name}",`);
               writer.writeLine(`schema: "${table_schema}",`);
            })
            .writeLine(",");
         writer.writeLine(
            `pk: [${primary_keys.length ? `"${primary_keys.map((pk) => getColumnName(pk.column_name)).join('","')}"` : ""}],`,
         );
         writer.writeLine(`dialect: "${getCodegenContext().plugin.dialect}",`);
         writer
            .write(`columns:`)
            .inlineBlock(() => {
               columns.forEach((col) => {
                  const colAlias = getColumnName(col.column_name);
                  writer.blankLine();
                  writer
                     .writeLine(`/**`)
                     .write(` * ${col.column_name} ${col.udt_name}`)
                     .write(col.column_default ? ` default ${col.column_default}` : "")
                     .newLine()
                     .writeLine(` */`)
                     .writeLine(`${colAlias}: "${col.column_name}",`);
               });
            })
            .writeLine(",");
         const dateColumns = columns.filter((col) => plugin.getColumnType(col).type === SqlLiteralType.Date);
         if (dateColumns.length) {
            writer
               .write(`jsonSchema:`)
               .inlineBlock(() => {
                  dateColumns.forEach((col) => {
                     writer.writeLine(`${getColumnName(col.column_name)}: "Date",`);
                  });
               })
               .writeLine(",");
         }
      })
      .write(");");
}

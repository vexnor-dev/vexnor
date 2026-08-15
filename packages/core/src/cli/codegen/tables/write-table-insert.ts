import { CodeWriter } from "#src/lib/code-writer.js";
import { PrintTableArgs } from "#src/plugin/plugin.js";
import { getCodegenContext } from "#src/cli/codegen/codegen-context.js";
import { writeColumnType } from "#src/cli/codegen/tables/write-column-type.js";

export function writeTableInsert(writer: CodeWriter, { table }: PrintTableArgs) {
   if (table.table_type === "view") return;
   const { getTableName, getColumnName, plugin } = getCodegenContext();
   const { columns, table_name } = table;
   const tableTypePrefix = `I${getTableName(table_name)}`;
   const tableTypeInsert = `${tableTypePrefix}Insert`;
   const tableTypeUpdate = `${tableTypePrefix}Update`;

   writer
      .blankLine()
      .write(`export type ${tableTypeInsert} =`)
      .inlineBlock(() => {
         columns.forEach((col) => {
            const isNullable = col.is_nullable.toUpperCase() === "YES";
            const columnName = getColumnName(col.column_name);
            if (col.column_default || isNullable) {
               writer.write(`${columnName}?:`);
            } else {
               writer.write(`${columnName}:`);
            }

            writer.write(" ");

            writeColumnType(writer, plugin.getColumnType(col), "insert", col.column_name);

            if (isNullable) {
               writer.write(" | null");
            }

            writer.write(";").newLine();
         });
      })
      .writeLine(";")
      .blankLine();

   writer.writeLine(`export type ${tableTypeUpdate} = Partial<${tableTypeInsert}>;`);
}

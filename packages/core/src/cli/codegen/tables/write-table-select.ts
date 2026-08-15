import { CodeWriter } from "#src/lib/code-writer.js";
import { PrintTableArgs } from "#src/plugin/plugin.js";
import { getCodegenContext } from "#src/cli/codegen/codegen-context.js";
import { writeColumnType } from "#src/cli/codegen/tables/write-column-type.js";

export function writeTableSelect(writer: CodeWriter, { table }: PrintTableArgs) {
   const { table_name, columns } = table;
   const { getTableName, getColumnName, plugin } = getCodegenContext();
   const tableTypePrefix = `I${getTableName(table_name)}`;

   writer
      .blankLine()
      .write(`export type ${tableTypePrefix}Select =`)
      .inlineBlock(() => {
         columns.forEach((col) => {
            const isNullable = col.is_nullable === "YES";
            const columnName = getColumnName(col.column_name);
            writer.write(`${columnName}: `);

            writeColumnType(writer, plugin.getColumnType(col), "select", col.column_name);
            writer.write(`${isNullable ? " | null" : ""};`).newLine();
         });
      })
      .writeLine(";")
      .blankLine()
      .write(`export type ${tableTypePrefix}Json = vexnor.JsonRow<${tableTypePrefix}Select>;`);
}

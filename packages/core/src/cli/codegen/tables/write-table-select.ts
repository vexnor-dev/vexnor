import { CodeWriter } from "#src/lib/code-writer.js";
import { ok } from "#src/lib/assert.js";
import to from "to-case";
import { PrintTableArgs, SqlLiteralType } from "#src/plugin/plugin.js";
import { getCodegenContext } from "#src/cli/codegen/codegen-context.js";

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

            const { type, udt, tsTypeSelect } = plugin.getColumnType(col);
            switch (type) {
               case SqlLiteralType.Udt:
                  ok(udt, `Udt type name is missing for column ${col.column_name}: ${type}`);
                  writer.write(`udt.${to.pascal(udt)}Udt`);
                  break;
               case SqlLiteralType.Date:
                  writer.write(`Date`);
                  break;
               case SqlLiteralType.Buffer:
                  writer.write(`Uint8Array`);
                  break;
               case SqlLiteralType.Bit:
                  writer.write(`vexnor.Bit`);
                  break;
               case SqlLiteralType.Json:
                  writer.write(`unknown`);
                  break;
               case SqlLiteralType.Custom:
                  ok(tsTypeSelect, `tsTypeSelect is required for Custom column ${col.column_name}`);
                  writer.write(tsTypeSelect);
                  break;
               default:
                  writer.write(`${type}`);
                  break;
            }
            writer.write(`${isNullable ? " | null" : ""};`).newLine();
         });
      })
      .writeLine(";")
      .blankLine()
      .write(`export type ${tableTypePrefix}Json = vexnor.JsonRow<${tableTypePrefix}Select>;`);
}

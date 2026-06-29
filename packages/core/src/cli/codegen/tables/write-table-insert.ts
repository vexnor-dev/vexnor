import { CodeWriter } from "#src/lib/code-writer.js";
import { ok } from "#src/lib/assert.js";
import to from "to-case";
import { PrintTableArgs, SqlLiteralType } from "#src/plugin/plugin.js";
import { getCodegenContext } from "#src/cli/codegen/codegen-context.js";

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

            const { type, udt, tsTypeSelect, tsTypeInsert } = plugin.getColumnType(col);
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
                  writer.write(tsTypeInsert ?? tsTypeSelect);
                  break;
               default:
                  writer.write(`${type}`);
                  break;
            }

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
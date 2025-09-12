import CodeBlockWriter from "code-block-writer";
import { getCodegenContext } from "../codegen-context.js";
import { PrintTableArgs, SqlLiteralType } from "../types/index.js";
import { ok } from "node:assert";
import to from "to-case";

export function writeTableInsert(writer: CodeBlockWriter.default, { table }: PrintTableArgs) {
   const { getTableName, getColumnName, getColumnType } = getCodegenContext();
   const { table_columns } = table;
   const tableTypeName = getTableName(table.table_name);
   const tableTypeInsert = `I${tableTypeName}Insert`;
   const tableTypeUpdate = `I${tableTypeName}Update`;

   writer
      .blankLine()
      .write(`export type ${tableTypeInsert} = `)
      .inlineBlock(() => {
         table_columns.forEach((col) => {
            const isNullable = col.is_nullable.toUpperCase() === "YES";
            const isUpdatable = col.is_updatable.toUpperCase() === "YES";
            const columnName = getColumnName(col.column_name);
            if (!isUpdatable) {
               writer.write("readonly ");
            }

            if (col.column_default || isNullable) {
               writer.write(`${columnName}?:`);
            } else {
               writer.write(`${columnName}:`);
            }

            writer.write(" ");

            const { type, udt } = getColumnType(col);
            switch (type) {
               case SqlLiteralType.Udt:
                  ok(udt, `Udt type name is missing for column ${col.column_name}: ${type}`);
                  writer.write(`udt.${to.pascal(udt)}Udt`);
                  break;
               case SqlLiteralType.Date:
                  writer.write(`Date`);
                  break;
               case SqlLiteralType.Buffer:
                  writer.write(`Buffer`);
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
      .blankLine();

   writer.writeLine(`export type ${tableTypeUpdate} = Partial<${tableTypeInsert}>;`);
}

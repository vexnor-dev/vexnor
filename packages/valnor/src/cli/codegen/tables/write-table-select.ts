import CodeBlockWriter from "code-block-writer";
import { ok } from "node:assert";
import to from "to-case";
import { PrintTableArgs, SqlLiteralType } from "../../../plugin/index.js";
import { getCodegenContext } from "../codegen-context.js";

export function writeTableSelect(writer: CodeBlockWriter.default, { table }: PrintTableArgs) {
   const { table_name, columns } = table;
   const { getTableName, getColumnName, plugin } = getCodegenContext();
   const tableTypeName = getTableName(table_name);

   writer
      .blankLine()
      .write(`export type I${tableTypeName}Select = `)
      .inlineBlock(() => {
         columns.forEach((col) => {
            const isNullable = col.is_nullable === "YES";
            const columnName = getColumnName(col.column_name);
            writer.write(`${columnName}: `);

            const { type, udt } = plugin.getColumnType(col);
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
            writer.write(`${isNullable ? " | null" : ""}`).newLine();
         });
      })
      .blankLine()
      .write(`export type I${tableTypeName}Json = valnor.JsonRow<I${tableTypeName}Select>;`);
}

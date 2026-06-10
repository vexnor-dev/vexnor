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

   const typeParams = isView
      ? `{ Select: ${tableTypeSelect} }`
      : `{ Select: ${tableTypeSelect}, Insert: ${tableTypeInsert}, Update: ${tableTypeUpdate}; Delete: true }`;

   writer
      .write(`export const ${tableTypeName} = vexnor.newSqlTable<${typeParams}>(`)
      .inlineBlock(() => {
         writer
            .writeLine(`crud:`)
            .inlineBlock(() => {
               writer.writeLine(`select: true, `);
               writer.writeLine(`insert: ${!isView}, `);
               writer.writeLine(`update: ${!isView}, `);
               writer.writeLine(`delete: ${!isView}, `);
            })
            .write(",")
            .writeLine("tableInfo:")
            .inlineBlock(() => {
               writer.writeLine(`name: "${table_name}",`);
               writer.writeLine(`schema: "${table_schema}",`);
            })
            .write(",");
         writer.writeLine(
            `pk: [${primary_keys.length ? `"${primary_keys.map((pk) => getColumnName(pk.column_name)).join('","')}"` : ""}], `,
         );
         writer.writeLine(`dialect: "${getCodegenContext().plugin.dialect}",`);
         writer
            .writeLine(`columns:`)
            .inlineBlock(() => {
               columns.forEach((col) => {
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
            })
            .write(",");
         const dateColumns = columns.filter((col) => plugin.getColumnType(col).type === SqlLiteralType.Date);
         if (dateColumns.length) {
            writer.writeLine(`jsonSchema:`).inlineBlock(() => {
               dateColumns.forEach((col) => {
                  writer.writeLine(`${getColumnName(col.column_name)}: "Date",`);
               });
            });
         }
      })
      .write(");");
}

import { getCodegenContext } from "../../codegen-context.js";
import CodeBlockWriter from "code-block-writer";
import { PrintTableArgs } from "../../types/index.js";

export function writeTableType(writer: CodeBlockWriter.default, { table }: PrintTableArgs) {
   const { getTableName, getColumnName } = getCodegenContext();
   const { table_name, table_columns, table_schema, primary_key } = table;
   const tableTypeName = getTableName(table_name);
   const tableTypeInsert = `I${tableTypeName}Insert`;
   const tableTypeUpdate = `I${tableTypeName}Update`;

   writer
      .write(`export interface I${tableTypeName} `)
      .inlineBlock(() => {
         if (primary_key) {
            writer.writeLine(`$$pk: postgres.Helper<"${primary_key}">, `);
         }

         writer.writeLine(`$$table: "${table_name}",`);
         // writer.writeLine(`$from: postgres.Helper<"${table_schema}.${table_name}">,`);
         writer.writeLine(
            `$$all: postgres.Helper<["${table_columns.map((col) => `${table_name}.${col.column_name}`).join(`", "`)}"]>,`,
         );

         table_columns.forEach((col) => {
            const alias = getColumnName(col.column_name);
            writer.blankLine();
            writer
               .writeLine(`/**`)
               .write(` * ${col.column_name} ${col.udt_name}`)
               .write(col.is_nullable ? "" : "not null")
               .write(col.column_default ? ` default ${col.column_default}` : "")
               .writeLine(`*/`)
               .writeLine(`${alias}: postgres.Helper<"${table_name}.${col.column_name}">,`);
         });

         writer.writeLine(`$$values(...values: ${tableTypeInsert}[]): postgres.Helper<${tableTypeInsert}[], []>`);
         writer.writeLine(`$$set(value: ${tableTypeUpdate}): postgres.Helper<${tableTypeUpdate}, []>`);
      })
      .blankLine();

   // IAccount & postgres.Helper<"one_sql.account">
   writer
      .write(
         `export function new${tableTypeName}(sql: postgres.Sql): I${tableTypeName} & postgres.Helper<"${table_schema}.${table_name}"> `,
      )
      .inlineBlock(() => {
         writer
            .write(`const obj: I${tableTypeName} = `)
            .inlineBlock(() => {
               if (primary_key) {
                  writer.writeLine(`$$pk: sql("${primary_key}"), `);
               }

               writer.writeLine(`$$table: "${table_name}",`);
               // writer.writeLine(`$from: sql("${table_schema}.${table_name}"),`);
               writer.writeLine(
                  `$$all: sql(["${table_columns.map((col) => `${table_name}.${col.column_name}`).join(`", "`)}"]),`,
               );
               writer
                  .write(`$$values(...values: ${tableTypeInsert}[])`)
                  .inlineBlock(() => {
                     writer.writeLine(`return sql<${tableTypeInsert}[], []>(values);`);
                  })
                  .write(",")
                  .blankLine();
               writer
                  .write(`$$set(value: ${tableTypeUpdate})`)
                  .inlineBlock(() => {
                     writer.writeLine(`return sql<${tableTypeUpdate}, []>(value);`);
                  })
                  .write(",")
                  .blankLine();

               table_columns.forEach((col) => {
                  const alias = getColumnName(col.column_name);
                  writer.blankLine();
                  writer
                     .writeLine(`/**`)
                     .write(` * ${col.column_name} ${col.udt_name}`)
                     .write(col.is_nullable ? "" : "not null")
                     .write(col.column_default ? ` default ${col.column_default}` : "")
                     .writeLine(`*/`)
                     .writeLine(`${alias}: sql("${table_name}.${col.column_name}"),`);
               });
            })
            .write(";");
         writer.writeLine(`const from = sql("${table_schema}.${table_name}");`);
         writer.writeLine(`return Object.assign(from, obj);`);
      })
      .blankLine();
}

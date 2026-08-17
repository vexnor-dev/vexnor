import { CodeWriter } from "#src/lib/code-writer.js";
import { writeColumnType } from "#src/cli/codegen/tables/write-column-type.js";
import type { SchemaCatalogObject } from "#src/schema/schema-catalog.js";

export function writeTableInsert(writer: CodeWriter, { table }: { table: SchemaCatalogObject }) {
   if (table.kind === "view") return;
   const { columns, mappingName } = table;
   const tableTypePrefix = `I${mappingName}`;
   const tableTypeInsert = `${tableTypePrefix}Insert`;
   const tableTypeUpdate = `${tableTypePrefix}Update`;

   writer
      .blankLine()
      .write(`export type ${tableTypeInsert} =`)
      .inlineBlock(() => {
         columns.forEach((col) => {
            const isNullable = col.nullable;
            const columnName = col.mappingName;
            if (col.default || isNullable) {
               writer.write(`${columnName}?:`);
            } else {
               writer.write(`${columnName}:`);
            }

            writer.write(" ");

            writeColumnType(writer, col, "insert");

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

import { CodeWriter } from "#src/lib/code-writer.js";
import { writeColumnType } from "#src/cli/codegen/tables/write-column-type.js";
import type { SchemaCatalogObject } from "#src/schema/schema-catalog.js";

export function writeTableSelect(writer: CodeWriter, { table }: { table: SchemaCatalogObject }) {
   const { mappingName, columns } = table;
   const tableTypePrefix = `I${mappingName}`;

   writer
      .blankLine()
      .write(`export type ${tableTypePrefix}Select =`)
      .inlineBlock(() => {
         columns.forEach((col) => {
            const isNullable = col.nullable;
            const columnName = col.mappingName;
            writer.write(`${columnName}: `);

            writeColumnType(writer, col, "select");
            writer.write(`${isNullable ? " | null" : ""};`).newLine();
         });
      })
      .writeLine(";")
      .blankLine()
      .write(`export type ${tableTypePrefix}Json = vexnor.JsonRow<${tableTypePrefix}Select>;`);
}

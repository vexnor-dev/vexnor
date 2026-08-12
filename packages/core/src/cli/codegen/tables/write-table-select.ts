import { CodeWriter } from "#src/lib/code-writer.js";
import { ok } from "#src/lib/assert.js";
import to from "to-case";
import { SqlLiteralType } from "#src/plugin/plugin.js";
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

            const type = col.normalizedType;
            const udt = col.customType?.udt;
            const tsTypeSelect = col.customType?.select;
            switch (type) {
               case SqlLiteralType.Udt:
                  ok(udt, `Udt type name is missing for column ${col.physicalName}: ${type}`);
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
                  ok(tsTypeSelect, `tsTypeSelect is required for Custom column ${col.physicalName}`);
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

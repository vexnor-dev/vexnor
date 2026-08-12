import { CodeWriter } from "#src/lib/code-writer.js";
import { ok } from "#src/lib/assert.js";
import to from "to-case";
import { SqlLiteralType } from "#src/plugin/plugin.js";
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

            const type = col.normalizedType;
            const udt = col.customType?.udt;
            const tsTypeSelect = col.customType?.select;
            const tsTypeInsert = col.customType?.insert;
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

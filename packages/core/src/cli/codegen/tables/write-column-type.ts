import to from "to-case";
import { CodeWriter } from "#src/lib/code-writer.js";
import { SqlColumnType, SqlLiteralType } from "#src/plugin/plugin.js";
import { ok } from "#src/lib/assert.js";
import type { SchemaCatalogColumn, SchemaCatalogColumnTypeTree } from "#src/schema/schema-catalog.js";

type SqlColumnStructureTree =
   | Extract<SchemaCatalogColumnTypeTree, { kind: "struct" }>
   | Extract<SchemaCatalogColumnTypeTree, { kind: "list" }>;

export function writeColumnType(writer: CodeWriter, column: SchemaCatalogColumn, mode: "select" | "insert"): void {
   if (column.typeTree) {
      writeTypeTree(writer, column.typeTree, mode);
      return;
   }

   writeScalarType(
      writer,
      {
         type: column.normalizedType,
         ...(column.customType?.udt ? { udt: column.customType.udt } : {}),
         ...(column.customType?.select ? { tsTypeSelect: column.customType.select } : {}),
         ...(column.customType?.insert ? { tsTypeInsert: column.customType.insert } : {}),
      },
      mode,
      column.physicalName,
   );
}

function writeScalarType(
   writer: CodeWriter,
   columnType: SqlColumnType,
   mode: "select" | "insert",
   columnName: string,
): void {
   const { type, udt, tsTypeSelect, tsTypeInsert } = columnType;
   switch (type) {
      case SqlLiteralType.Udt:
         ok(udt, `Udt type name is missing for column ${columnName}: ${type}`);
         writer.write(`udt.${to.pascal(udt)}Udt`);
         break;
      case SqlLiteralType.Date:
         writer.write("Date");
         break;
      case SqlLiteralType.Buffer:
         writer.write("Uint8Array");
         break;
      case SqlLiteralType.Bit:
         writer.write("vexnor.Bit");
         break;
      case SqlLiteralType.Json:
      case SqlLiteralType.Unknown:
         writer.write("unknown");
         break;
      case SqlLiteralType.Custom:
         ok(tsTypeSelect, `tsTypeSelect is required for Custom column ${columnName}`);
         writer.write(mode === "insert" ? (tsTypeInsert ?? tsTypeSelect) : tsTypeSelect);
         break;
      default:
         writer.write(type);
   }
}

export function writeColumnStructure(writer: CodeWriter, tree: SqlColumnStructureTree): void {
   if (tree.kind === "struct") {
      writer.inlineBlock(() => {
         writer.writeLine('kind: "struct",');
         writer
            .write("fields:")
            .inlineBlock(() => {
               for (const field of tree.fields) {
                  writer
                     .write(`${field.mappingName}:`)
                     .inlineBlock(() => {
                        writer.writeLine(`fieldName: ${JSON.stringify(field.physicalName)},`);
                        if (isColumnStructure(field.value)) {
                           writer.write("structure:");
                           writeColumnStructure(writer, field.value);
                           writer.writeLine(",");
                        }
                     })
                     .writeLine(",");
               }
            })
            .writeLine(",");
      });
      return;
   }

   writer.inlineBlock(() => {
      writer.writeLine('kind: "list",');
      writer.write("value:");
      if (isColumnStructure(tree.value)) {
         writeColumnStructure(writer, tree.value);
      } else {
         writer.write(" null");
      }
      writer.writeLine(",");
   });
}

export function isColumnStructure(tree: SchemaCatalogColumnTypeTree): tree is SqlColumnStructureTree {
   return tree.kind === "struct" || tree.kind === "list";
}

function writeTypeTree(writer: CodeWriter, tree: SchemaCatalogColumnTypeTree, mode: "select" | "insert"): void {
   switch (tree.kind) {
      case "scalar":
         writeScalarType(writer, { type: tree.type, ...(tree.udt ? { udt: tree.udt } : {}) }, mode, "nested field");
         break;
      case "struct":
         writer.inlineBlock(() => {
            for (const field of tree.fields) {
               writer.write(`${mode === "select" ? field.mappingName : field.physicalName}: `);
               writeTypeTree(writer, field.value, mode);
               writer.writeLine(" | null;");
            }
         });
         break;
      case "list":
         writer.write("Array<");
         writeTypeTree(writer, tree.value, mode);
         writer.write(" | null>");
         break;
      case "map":
         if (mode === "insert") {
            writer.write("Map<");
            writeTypeTree(writer, tree.key, mode);
            writer.write(", ");
            writeTypeTree(writer, tree.value, mode);
            writer.write(">");
         } else {
            writer
               .write("Array<")
               .inlineBlock(() => {
                  writer.write("key: ");
                  writeTypeTree(writer, tree.key, mode);
                  writer.writeLine(";");
                  writer.write("value: ");
                  writeTypeTree(writer, tree.value, mode);
                  writer.writeLine(" | null;");
               })
               .write(">");
         }
         break;
      case "union":
         tree.members.forEach((member, index) => {
            if (index) writer.write(" | ");
            writeTypeTree(writer, member.value, mode);
         });
         break;
   }
}

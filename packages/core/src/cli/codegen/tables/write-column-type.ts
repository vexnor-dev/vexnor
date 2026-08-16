import to from "to-case";
import { CodeWriter } from "#src/lib/code-writer.js";
import { SqlColumnType, SqlColumnTypeTree, SqlLiteralType } from "#src/plugin/plugin.js";
import { ok } from "#src/lib/assert.js";
import { getCodegenContext } from "#src/cli/codegen/codegen-context.js";

type SqlColumnStructureTree =
   | Extract<SqlColumnTypeTree, { kind: "struct" }>
   | Extract<SqlColumnTypeTree, { kind: "list" }>;

export function writeColumnType(
   writer: CodeWriter,
   columnType: SqlColumnType,
   mode: "select" | "insert",
   columnName: string,
): void {
   if (columnType.typeTree) {
      writeTypeTree(writer, columnType.typeTree, mode, getCodegenContext().getColumnName);
      return;
   }

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

export function writeColumnStructure(
   writer: CodeWriter,
   tree: SqlColumnStructureTree,
   getColumnName: (name: string) => string,
): void {
   if (tree.kind === "struct") {
      writer.inlineBlock(() => {
         writer.writeLine('kind: "struct",');
         writer.write("fields:").inlineBlock(() => {
            for (const field of tree.fields) {
               writer.write(`${getColumnName(field.name)}:`).inlineBlock(() => {
                  writer.writeLine(`fieldName: ${JSON.stringify(field.name)},`);
                  if (isColumnStructure(field.value)) {
                     writer.write("structure:");
                     writeColumnStructure(writer, field.value, getColumnName);
                     writer.writeLine(",");
                  }
               }).writeLine(",");
            }
         }).writeLine(",");
      });
      return;
   }

   writer.inlineBlock(() => {
      writer.writeLine('kind: "list",');
      writer.write("value:");
      if (isColumnStructure(tree.value)) {
         writeColumnStructure(writer, tree.value, getColumnName);
      } else {
         writer.write(" null");
      }
      writer.writeLine(",");
   });
}

export function isColumnStructure(tree: SqlColumnTypeTree): tree is SqlColumnStructureTree {
   return tree.kind === "struct" || tree.kind === "list";
}

function writeTypeTree(
   writer: CodeWriter,
   tree: SqlColumnTypeTree,
   mode: "select" | "insert",
   getColumnName: (name: string) => string,
): void {
   switch (tree.kind) {
      case "scalar":
         writeColumnType(writer, { type: tree.type, udt: tree.udt }, mode, "nested field");
         break;
      case "struct":
         writer.inlineBlock(() => {
            for (const field of tree.fields) {
               writer.write(`${mode === "select" ? getColumnName(field.name) : field.name}: `);
               writeTypeTree(writer, field.value, mode, getColumnName);
               writer.writeLine(" | null;");
            }
         });
         break;
      case "list":
         writer.write("Array<");
         writeTypeTree(writer, tree.value, mode, getColumnName);
         writer.write(" | null>");
         break;
      case "map":
         if (mode === "insert") {
            writer.write("Map<");
            writeTypeTree(writer, tree.key, mode, getColumnName);
            writer.write(", ");
            writeTypeTree(writer, tree.value, mode, getColumnName);
            writer.write(">");
         } else {
            writer.write("Array<").inlineBlock(() => {
               writer.write("key: ");
               writeTypeTree(writer, tree.key, mode, getColumnName);
               writer.writeLine(";");
               writer.write("value: ");
               writeTypeTree(writer, tree.value, mode, getColumnName);
               writer.writeLine(" | null;");
            }).write(">");
         }
         break;
      case "union":
         tree.members.forEach((member, index) => {
            if (index) writer.write(" | ");
            writeTypeTree(writer, member.value, mode, getColumnName);
         });
         break;
   }
}

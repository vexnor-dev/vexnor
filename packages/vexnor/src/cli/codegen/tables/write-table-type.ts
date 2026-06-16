import { CodeWriter } from "#/lib/code-writer.js";
import { PrintTableArgs, SqlForeignKeyInfo, SqlLiteralType } from "#/plugin/plugin.js";
import { getCodegenContext } from "#/cli/codegen/codegen-context.js";

export function writeTableType(writer: CodeWriter, { table }: PrintTableArgs) {
   const { getTableName, getColumnName, plugin } = getCodegenContext();
   const { table_name, columns, table_schema, primary_keys, table_type, foreign_keys } = table;
   const isView = table_type === "view";
   const tableTypeName = getTableName(table_name);
   const tableTypePrefix = `I${tableTypeName}`;
   const tableTypeSelect = `${tableTypePrefix}Select`;
   const tableTypeInsert = `${tableTypePrefix}Insert`;
   const tableTypeUpdate = `${tableTypePrefix}Update`;

   writer
      .write(`export const ${tableTypeName} = vexnor.newSqlTable`)
      .genericBlock(() => {
         writer.writeLine(`Select: ${tableTypeSelect};`);
         if (!isView) {
            writer.writeLine(`Insert: ${tableTypeInsert};`);
            writer.writeLine(`Update: ${tableTypeUpdate};`);
            writer.writeLine(`Delete: true;`);
         }
      })
      .write(`(`)
      .inlineBlock(() => {
         writer
            .write(`crud:`)
            .inlineBlock(() => {
               writer.writeLine(`select: true,`);
               writer.writeLine(`insert: ${!isView},`);
               writer.writeLine(`update: ${!isView},`);
               writer.writeLine(`delete: ${!isView},`);
            })
            .writeLine(",");
         writer
            .write("tableInfo:")
            .inlineBlock(() => {
               writer.writeLine(`name: "${table_name}",`);
               writer.writeLine(`schema: "${table_schema}",`);
            })
            .writeLine(",");
         writer.writeLine(
            `pk: [${primary_keys.length ? `"${primary_keys.map((pk) => getColumnName(pk.column_name)).join('","')}"` : ""}],`,
         );
         writer.writeLine(`dialect: "${getCodegenContext().plugin.dialect}",`);
         writer.writeLine(`source: "${getCodegenContext().source}",`);
         writer
            .write(`columns:`)
            .inlineBlock(() => {
               columns.forEach((col) => {
                  const colAlias = getColumnName(col.column_name);
                  writer.blankLine();
                  writer
                     .writeLine(`/**`)
                     .write(` * ${col.column_name} ${col.udt_name}`)
                     .write(col.column_default ? ` default ${col.column_default}` : "")
                     .newLine()
                     .writeLine(` */`)
                     .writeLine(`${colAlias}: "${col.column_name}",`);
               });
            })
            .writeLine(",");
         const columnTypes = columns.map((col) => ({ col, colType: plugin.getColumnType(col) }));
         const dateColumns = columnTypes.filter(({ colType }) => colType?.type === SqlLiteralType.Date);
         if (dateColumns.length) {
            writer
               .write(`jsonSchema:`)
               .inlineBlock(() => {
                  dateColumns.forEach(({ col }) => {
                     writer.writeLine(`${getColumnName(col.column_name)}: "Date",`);
                  });
               })
               .writeLine(",");
         }
         // Emit foreign keys (tables only, not views)
         const fks = groupForeignKeys(foreign_keys ?? [], getColumnName);
         if (!isView && fks.length) {
            writer.writeLine(`fk: [`);
            fks.forEach((fk) => {
               writer.writeLine(
                  `   { from: [${fk.from.map((c) => `"${c}"`).join(", ")}], to: { schema: "${fk.toSchema}", table: "${fk.toTable}", columns: [${fk.toColumns.map((c) => `"${c}"`).join(", ")}] } },`,
               );
            });
            writer.writeLine(`],`);
         }
         // Emit dbSchema
         const { enums } = getCodegenContext();
         writer
            .write(`dbSchema:`)
               .inlineBlock(() => {
                  columnTypes.forEach(({ col, colType }) => {
                     const colAlias = getColumnName(col.column_name);
                     if (!colType) {
                        throw new Error(`plugin.getColumnType() returned undefined for column "${col.column_name}" on table "${table_name}"`);
                     }
                     const nullable = col.is_nullable === "YES";
                     const parts: string[] = [
                        `dbType: "${col.udt_name ?? col.data_type ?? "unknown"}"`,
                        `type: vexnor.SqlLiteralType.${Object.entries(SqlLiteralType).find(([, v]) => v === colType.type)?.[0] ?? "Unknown"}`,
                     ];
                     if (nullable) parts.push(`nullable: true`);
                     if (col.column_default != null) parts.push(`default: ${JSON.stringify(col.column_default)}`);
                     if (colType.type === SqlLiteralType.Udt && colType.udt) {
                        const enumInfo = enums.find((e) => e.enum_name === colType.udt);
                        if (enumInfo) {
                           parts.push(`values: [${enumInfo.enum_values.map((v) => `"${v.enum_label}"`).join(", ")}]`);
                        }
                     }
                     writer.writeLine(`${colAlias}: { ${parts.join(", ")} },`);
                  });
               })
               .writeLine(",");
      })
      .write(");");
}

export function groupForeignKeys(
   foreignKeys: SqlForeignKeyInfo[],
   getColumnName: (name: string) => string,
): { from: string[]; toSchema: string; toTable: string; toColumns: string[] }[] {
   const grouped = new Map<string, { from: string[]; toSchema: string; toTable: string; toColumns: string[] }>();
   for (const fk of foreignKeys) {
      const key = fk.constraint_name;
      const existing = grouped.get(key);
      if (existing) {
         existing.from.push(getColumnName(fk.column_name));
         existing.toColumns.push(getColumnName(fk.referenced_column_name));
      } else {
         grouped.set(key, {
            from: [getColumnName(fk.column_name)],
            toSchema: fk.referenced_table_schema,
            toTable: fk.referenced_table_name,
            toColumns: [getColumnName(fk.referenced_column_name)],
         });
      }
   }
   return [...grouped.values()];
}

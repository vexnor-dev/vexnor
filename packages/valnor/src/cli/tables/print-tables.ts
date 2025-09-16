import fs from "node:fs/promises";
import path from "node:path";
import to from "to-case";
import { getCodegenContext, SqlOutputFile, SqlTableInfo } from "../../plugin/index.js";
import { logger } from "../logger.js";
import { writeTable } from "./write-table.js";

export interface WriteTablesArgs {
   tables: SqlTableInfo[];
}

export async function printTables({ tables }: WriteTablesArgs): Promise<SqlOutputFile[]> {
   const files: SqlOutputFile[] = [];
   const { outDir, getTableName } = getCodegenContext();
   for (const table of tables) {
      const { table_name, table_schema } = table;
      const output = writeTable({ table });
      const fileName = `${to.snake(table_schema)}.${to.snake(table_name)}-table`;
      const filePath = path.join(outDir, `${fileName}.ts`);
      files.push({
         moduleName: table_name,
         fileName,
         schemaName: table_schema,
         tableTypeName: getTableName(table_name),
      });
      logger.debug({ tableSchema: table_schema, tableName: table_name, filePath }, "Writing table file");
      await fs.writeFile(filePath, output, { encoding: "utf8" });
      await fs.stat(filePath);
   }

   return files;
}

import fs from "node:fs/promises";
import path from "node:path";
import to from "to-case";
import { SqlOutputFile } from "../types/index.js";
import { getCodegenContext } from "../codegen-context.js";
import { logger } from "../logger.js";
import { postgres } from "./postgres/index.js";
import { pg } from "./pg/index.js";
import { SqlTableInfo } from "../../plugin/index.js";
import { x } from "../../x.js";

export interface WriteTablesArgs {
   tables: SqlTableInfo[];
}

export async function printTables({ tables }: WriteTablesArgs): Promise<SqlOutputFile[]> {
   const files: SqlOutputFile[] = [];
   const { outDir, getTableName, driver } = getCodegenContext();
   const { writeTable } = x(() => {
      switch (driver) {
         case "pg":
            return pg;
         case "postgres.js":
            return postgres;
         default:
            throw new Error(`Unsupported driver: ${driver}`);
      }
   });

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

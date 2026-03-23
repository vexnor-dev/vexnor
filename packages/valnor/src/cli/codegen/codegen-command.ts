import path from "node:path";
import fs from "node:fs/promises";
import { loadPlugin } from "#/load-plugin.js";
import { ok } from "#/lib/assert.js";
import { CodegenCommandOptions } from "#/cli/codegen/types/types.js";
import { CodegenContext, CodegenContextModel, getCodegenContext } from "#/cli/codegen/codegen-context.js";
import { printEnums } from "#/cli/codegen/schemas/print-enums.js";
import { printSchemas } from "#/cli/codegen/schemas/print-schema.js";
import { printTables } from "#/cli/codegen/tables/print-tables.js";
import { writeLibrary } from "#/cli/codegen/library/write-library.js";
import { writeIndex } from "#/cli/codegen/write-index.js";

export async function codegenCommand(options: CodegenCommandOptions) {
   const {
      uri,
      schema: schemas,
      pascalCaseTables,
      camelCaseColumns,
      plugin: pluginName,
      host,
      port,
      user,
      database,
      password,
   } = options;
   const outDir = path.resolve(options.outDir);
   const stat = await fs.stat(outDir);
   if (!stat.isDirectory()) {
      throw new Error(`${outDir} is not a valid output directory`);
   }

   const { plugin } = await loadPlugin(pluginName);
   const { enums, tables } = await (() => {
      if (uri) {
         return plugin.getSchema({ uri, schemas });
      }

      ok(host && port && user && database && password, "host, port, user, database, and password are required");
      return plugin.getSchema({
         schemas,
         host,
         port,
         user,
         database,
         password,
      });
   })();

   const context = new CodegenContextModel({
      outDir,
      plugin,
      pascalCaseTables,
      camelCaseColumns,
      includeEnums: enums.length > 0,
   });

   const files = await fs.readdir(outDir);
   for (const file of files) {
      await fs.rm(path.join(outDir, file));
   }

   await CodegenContext.run(context, async () => {
      const { outDir } = getCodegenContext();
      ok(outDir, "outDir is not defined");
      ok(tables, "tables are not defined");
      ok(enums, "enums are not defined");

      const enumFiles = await printEnums({ enums });
      const tableFiles = await printTables({
         tables,
      });
      const schemaFiles = await printSchemas({
         files: [...tableFiles, ...enumFiles],
      });
      const libraryFiles = await writeLibrary();
      await writeIndex({
         libraryFiles,
         schemaFiles,
      });
   });
}

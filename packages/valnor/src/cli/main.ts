import { Command, Option } from "commander";
import * as console from "node:console";
import * as path from "node:path";
import * as fs from "node:fs/promises";
import { writeIndex } from "./write-index.js";
import { printEnums, printSchemas } from "./schemas/index.js";
import { CodegenContext, CodegenContextModel, getCodegenContext } from "./codegen-context.js";
import { CommandOptions, SqlDrivers } from "./types/index.js";
import { printTables } from "./tables/index.js";
import { ok } from "assert";
import { writeLibrary } from "./lib/index.js";
import { loadPlugin } from "../load-plugin.js";
import { x } from "../x.js";

const main = new Command();

main
   .name("valnor")
   .description(
      `A powerful TypeScript code generator that creates type-safe mappings from PostgreSQL schemas to TypeScript, enabling type-safe SQL queries with [**postgres.js**](https://www.npmjs.com/package/postgres).`,
   )
   .command("generate")
   //.argument('<tableName>')
   .description("Generates SQL mapping for specified database")
   .addOption(new Option("--driver <driver>", "Database name").choices(SqlDrivers))
   .addOption(
      new Option("--uri <uri>", "Database URI")
         .conflicts(["host", "port", "user", "password", "database"])
         .makeOptionMandatory(false),
   )
   .addOption(new Option("--host <host>", "Database host").conflicts(["uri"]).makeOptionMandatory(false))
   .addOption(new Option("--database <uri>", "Database name").conflicts(["uri"]).makeOptionMandatory(false))
   .addOption(new Option("--user <host>", "Database connection user").conflicts(["uri"]).makeOptionMandatory(false))
   .addOption(
      new Option("--password <uri>", "Database connection password").conflicts(["password"]).makeOptionMandatory(false),
   )
   .requiredOption("--outDir <directory>", "Output directory to generate the mapping files into")
   .requiredOption("--cli <cli...>", "Database cli(s) to generate mapping code for")
   .addOption(new Option("--port <port>", "Database port").preset("5432").argParser(parseInt))
   .option("--pascalCaseTables", "Use PascalCase for table names")
   .option("--camelCaseColumns", "Use camelCase for column names")
   .action(async (options: CommandOptions) => {
      const {
         uri,
         schema: schemas,
         pascalCaseTables,
         camelCaseColumns,
         driver,
         host,
         port,
         user,
         database,
         password,
      } = options;
      const outDir = path.resolve(options.outDir);
      const dirExists = await fs.stat(outDir);
      if (!dirExists?.isDirectory()) {
         console.error(`${outDir} is not a valid output directory`);
         return;
      }

      const plugin = await loadPlugin(driver);
      const { enums, tables } = await x(() => {
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
      });

      const context = new CodegenContextModel({
         outDir,
         getColumnType: plugin.getColumnType,
         driver,
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
   });

main.parse();

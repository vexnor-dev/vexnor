import { Command, Option } from "commander";
import * as console from "node:console";
import * as path from "node:path";
import * as fs from "node:fs/promises";
import { writeIndex } from "./write-index.js";
import { printEnums, printSchemas } from "./schemas/index.js";
import { CodegenContext, CodegenContextModel, getCodegenContext } from "./codegen-context.js";
import { CommandOptions } from "./types/index.js";
import { printTables } from "./tables/index.js";
import { ok } from "assert";
import { writeLibrary } from "./library/index.js";
import { loadPlugin } from "../load-plugin.js";
import { execCommand, ExecOptions, initCommand, InitOptions } from "./exec/index.js";

const main = new Command();

main
   .name("valnor")
   .description(
      `A powerful TypeScript code generator that creates type-safe mappings from PostgreSQL schemas to TypeScript, enabling type-safe SQL queries with [**postgres.js**](https://www.npmjs.com/package/postgres).`,
   )
   .command("generate")
   //.argument('<tableName>')
   .description("Generates SQL mapping for specified database")
   .addOption(new Option("--plugin <plugin>", "Valnor plugin"))
   .addOption(
      new Option("--uri <uri>", "Database URI")
         .conflicts(["host", "port", "user", "password", "database"])
         .makeOptionMandatory(false),
   )
   .addOption(new Option("--host <host>", "Database host").conflicts(["uri"]).makeOptionMandatory(false))
   .addOption(
      new Option("--port <port>", "Database port")
         .conflicts(["uri"])
         .preset(5432)
         .argParser(parseInt)
         .makeOptionMandatory(false),
   )
   .addOption(new Option("--database <database>", "Database name").conflicts(["uri"]).makeOptionMandatory(false))
   .addOption(new Option("--user <user>", "Database connection user").conflicts(["uri"]).makeOptionMandatory(false))
   .addOption(
      new Option("--password <password>", "Database connection password").conflicts(["uri"]).makeOptionMandatory(false),
   )
   .requiredOption("--outDir <directory>", "Output directory to generate the mapping files into")
   .requiredOption("--schema <schema...>", "Database schema(s) to generate mapping code for")
   .option("--pascalCaseTables", "Use PascalCase for table names")
   .option("--camelCaseColumns", "Use camelCase for column names")
   .action(async (options: CommandOptions) => {
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
      const dirExists = await fs.stat(outDir);
      if (!dirExists?.isDirectory()) {
         console.error(`${outDir} is not a valid output directory`);
         return;
      }

      const plugin = await loadPlugin(pluginName);
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
   });

const exec = main.command("exec").description("Execute and manage queries");

exec
   .command("init")
   .description("Initialize valnor config files")
   .option("-f, --force", "Overwrite existing files")
   .action(async (options: InitOptions) => {
      await initCommand(options);
   });

exec
   .command("run")
   .description("Execute a configured query")
   .argument("<query>", "Query name to execute")
   .option("-c, --config <path>", "Path to valnor.config.ts", "valnor.config.ts")
   .option("-q, --query-config <path>", "Path to query config file")
   .option("-e, --env <environment>", "Environment to use for params")
   .option("-f, --format <format>", "Output format (table|json|csv)")
   .option("-l, --limit <number>", "Limit number of results", parseInt)
   .option("--dry-run", "Show SQL without executing")
   .option("--no-confirm", "Skip confirmation for mutations")
   .action(async (queryName: string, options: ExecOptions) => {
      await execCommand(queryName, options);
   });

main.parse();

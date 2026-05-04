import { Command, Option } from "commander";
import { execCommand, ExecOptions } from "#/cli/exec/exec-command.js";
import { initCommand, InitOptions } from "#/cli/exec/init-command.js";
import { codegenCommand } from "#/cli/codegen/codegen-command.js";
import { CodegenCommandOptions } from "#/cli/codegen/types/types.js";

const main = new Command();

main
   .name("valnor")
   .description(
      `A powerful TypeScript code generator that creates type-safe mappings from PostgreSQL schemas to TypeScript, enabling type-safe SQL queries.`,
   )
   .command("codegen")
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
   .option("--omit <tables...>", "Table names to omit from codegen (e.g. migration_valnor or schema.table_name)")
   .action(async (options: CodegenCommandOptions) => {
      await codegenCommand(options);
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

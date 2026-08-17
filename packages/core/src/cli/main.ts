import { Command, Option } from "commander";
import { execCommand, ExecOptions } from "#src/cli/exec/exec-command.js";
import { initCommand, InitOptions } from "#src/cli/exec/init-command.js";
import { codegenCommand } from "#src/cli/codegen/codegen-command.js";
import { CodegenCommandOptions } from "#src/cli/codegen/types/types.js";
import { serializeCommand, SerializeOptions } from "#src/cli/serialize/serialize-command.js";
import { schemaSelectCommand, SchemaSelectCommandOptions } from "#src/cli/schema/schema-select-command.js";
import { schemaMcpCommand, SchemaMcpCommandOptions } from "#src/cli/schema/schema-mcp-command.js";
import { schemaDiscoverCommand, SchemaDiscoverCommandOptions } from "#src/cli/schema/schema-discover-command.js";
import { parseNumberOption } from "#src/cli/parse-number-option.js";

const main = new Command();

main
   .name("vexnor")
   .description(
      `A powerful TypeScript code generator that creates type-safe mappings from PostgreSQL schemas to TypeScript, enabling type-safe SQL queries.`,
   )
   .command("codegen")
   //.argument('<tableName>')
   .description("Generates SQL mapping for specified database")
   .addOption(new Option("--plugin <plugin>", "Vexnor plugin"))
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
   .option("--camelCaseColumns", "Use camelCase for column names")
   .option("--omit <tables...>", "Table names to omit from codegen (e.g. migration_vexnor or schema.table_name)")
   .option("-c, --config <path>", "Path to vexnor.config.ts", "vexnor.config.ts")
   .option("-p, --profile <profile>", "Profile to use from vexnor.config.ts")
   .option("--selection-config <path>", "Override the local selection config path")
   .action(async (options: CodegenCommandOptions) => {
      await codegenCommand(options);
   });

const exec = main.command("exec").description("Execute and manage queries");

exec
   .command("init")
   .description("Initialize vexnor config files")
   .option("-f, --force", "Overwrite existing files")
   .action(async (options: InitOptions) => {
      await initCommand(options);
   });

const schema = main.command("schema").description("Discover and work with datasource schemas");

schema
   .command("discover")
   .description("List database schemas exposed by a Vexnor profile")
   .option("-c, --config <path>", "Path to vexnor.config.ts", "vexnor.config.ts")
   .option("-p, --profile <profile>", "Profile to use from vexnor.config.ts")
   .action(async (options: SchemaDiscoverCommandOptions) => {
      await schemaDiscoverCommand(options);
   });

schema
   .command("select")
   .description("Review and persist the schema objects exposed by a Vexnor profile")
   .option("-c, --config <path>", "Path to vexnor.config.ts", "vexnor.config.ts")
   .option("-p, --profile <profile>", "Profile to use from vexnor.config.ts")
   .option("--selection-config <path>", "Override the local selection config path")
   .option("--include <objects...>", "Select only these schema-qualified objects")
   .option("--exclude <objects...>", "Exclude these schema-qualified objects")
   .option("--all", "Select every discovered object")
   .option("--save", "Persist a non-interactive selection override")
   .action(async (options: SchemaSelectCommandOptions) => {
      await schemaSelectCommand(options);
   });

schema
   .command("mcp")
   .description("Serve selected read-only datasource tools over stdio MCP")
   .option("-c, --config <path>", "Path to vexnor.config.ts", "vexnor.config.ts")
   .option("-p, --profile <profile>", "Profile to use from vexnor.config.ts")
   .option("--selection-config <path>", "Override the local selection config path")
   .requiredOption("--tools <tools...>", "Explicit enabled tools: getSchema, join, fetchData")
   .option("--max-rows <number>", "Maximum rows returned by one fetch", parseNumberOption, 100)
   .option("--timeout-ms <number>", "Maximum query execution time in milliseconds", parseNumberOption, 30_000)
   .option("--max-concurrency <number>", "Maximum concurrent local queries", parseNumberOption, 1)
   .action(async (options: SchemaMcpCommandOptions) => {
      await schemaMcpCommand(options);
   });

exec
   .command("run")
   .description("Execute a configured query")
   .argument("<query>", "Query name to execute")
   .option("-c, --config <path>", "Path to vexnor.config.ts", "vexnor.config.ts")
   .option("-q, --query-config <path>", "Path to query config file")
   .option("-e, --env <environment>", "Environment to use for params")
   .option("-ctx, --context <key=value...>", "Runtime param values (e.g. --context userId=abc123)")
   .option("-f, --format <format>", "Output format (table|json|csv)")
   .option("-l, --limit <number>", "Limit number of results", parseInt)
   .option("--dry-run", "Show SQL without executing")
   .option("--no-confirm", "Skip confirmation for mutations")
   .action(async (queryName: string, options: ExecOptions) => {
      await execCommand(queryName, options);
   });

main
   .command("serialize")
   .description("Serialize registered queries to portable JSON manifests for cross-stack execution")
   .requiredOption("-i, --input <glob>", "Glob pattern for files exporting queries")
   .requiredOption("-o, --output <dir>", "Output directory for manifest JSON files (one per source file)")
   .requiredOption("-d, --dialect <dialect>", "SQL dialect (postgresql, transactsql, sqlite)")
   .action(async (options: SerializeOptions) => {
      await serializeCommand(options);
   });

await main.parseAsync();

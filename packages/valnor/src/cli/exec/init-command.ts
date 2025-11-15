import * as fs from "node:fs/promises";
import * as path from "node:path";

export interface InitOptions {
   force?: boolean;
}

const VALNOR_CONFIG_TEMPLATE = `import { defineConfig } from "valnor";

export default defineConfig({
   profiles: {
      dev: {
         plugin: "<SET ME>",
         connection: {
            host: "localhost",
            port: 5432,
            database: "mydb",
            user: "postgres",
            password: "postgres",
         },
         generate: {
            schemas: ["public"],
            outDir: "src/generated",
         },
      },
   },
   defaultProfile: "dev",
   exec: {
      format: "table",
      confirmMutations: true,
      confirmDestructive: true,
   },
});
`;

const QUERY_CONFIG_TEMPLATE = `import { defineQueryConfig } from "valnor";
import { sql } from "valnor";

// Define your queries
const exampleQuery = sql\`SELECT * FROM users WHERE id = $1\`;

export default defineQueryConfig({ exampleQuery })({
   queries: {
      exampleQuery: {
         profile: "dev",
         params: {
            dev: [1],
            prod: [1],
         },
      },
   },
});
`;

export async function initCommand(options: InitOptions): Promise<void> {
   const configPath = path.resolve("valnor.config.ts");
   const queryConfigPath = path.resolve("queries.valnor.ts");

   const configExists = await fs
      .access(configPath)
      .then(() => true)
      .catch(() => false);
   const queryConfigExists = await fs
      .access(queryConfigPath)
      .then(() => true)
      .catch(() => false);

   if (configExists && !options.force) {
      throw new Error(`valnor.config.ts already exists. Use --force to overwrite.`);
   }

   if (queryConfigExists && !options.force) {
      throw new Error(`queries.valnor.ts already exists. Use --force to overwrite.`);
   }

   await fs.writeFile(configPath, VALNOR_CONFIG_TEMPLATE, "utf-8");
   console.log(`✓ Created valnor.config.ts`);

   await fs.writeFile(queryConfigPath, QUERY_CONFIG_TEMPLATE, "utf-8");
   console.log(`✓ Created queries.valnor.ts`);

   console.log(`\nNext steps:`);
   console.log(`1. Update valnor.config.ts with your database connection details`);
   console.log(`2. Define your queries in queries.valnor.ts`);
   console.log(`3. Run: valnor exec exampleQuery`);
}

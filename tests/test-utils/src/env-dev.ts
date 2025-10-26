import { GetEnvVars } from "env-cmd";

export async function loadEnv({ filePath, environments }: { filePath: string; environments: string[] }) {
   const envDevVars = await GetEnvVars({
      rc: {
         environments,
         filePath,
      },
      verbose: true,
   });

   Object.assign(process.env, envDevVars);
}

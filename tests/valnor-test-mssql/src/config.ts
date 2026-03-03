import { Type } from "@sinclair/typebox";
import { Value } from "@sinclair/typebox/value";
import { loadEnv } from "@valnor/test-utils";

const Env = Type.Object({
   ENV_PATH: Type.String({ minLength: 1 }),
});

export async function readEnv() {
   return Value.Decode(Env, process.env);
}

const Config = Type.Object({
   MSSQL_USER: Type.String({ minLength: 1 }),
   MSSQL_PASSWORD: Type.String({ minLength: 1 }),
   MSSQL_DATABASE: Type.String({ minLength: 1 }),
   MSSQL_HOST: Type.String({ minLength: 1 }),
   MSSQL_PORT: Type.Transform(Type.String({ minLength: 1 }))
      .Decode((value) => {
         const port = parseInt(value);
         if (isNaN(port)) {
            throw new Error("MSSQL_PORT must be a number");
         }
         return port;
      })
      .Encode((value) => value.toString()),
});

export async function readConfig() {
   const { ENV_PATH } = await readEnv();
   const env = await loadEnv({
      filePath: ENV_PATH,
      environments: ["mssql"],
   });

   console.log({ env });

   return Value.Decode(Config, process.env);
}

export const tags = new Map<string, string>();
export function getTag(arg: { name: string }): string {
   if (tags.has(arg.name)) {
      return tags.get(arg.name)!;
   }

   tags.set(arg.name, `tag_${tags.size + 1}`);
   return tags.get(arg.name)!;
}

export const { MSSQL_USER, MSSQL_DATABASE, MSSQL_PORT, MSSQL_HOST, MSSQL_PASSWORD } = await readConfig();

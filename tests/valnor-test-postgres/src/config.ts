import { Type } from "@sinclair/typebox";
import { Value } from "@sinclair/typebox/value";
import { loadEnv } from "@valnor/test-utils";

const Env = Type.Object({
   VALNOR_ENV_PATH: Type.String({ minLength: 1 }),
});

const Config = Type.Object({
   POSTGRES_USER: Type.String({ minLength: 1 }),
   POSTGRES_PASSWORD: Type.String({ minLength: 1 }),
   POSTGRES_DATABASE: Type.String({ minLength: 1 }),
   POSTGRES_HOST: Type.String({ minLength: 1 }),
   POSTGRES_PORT: Type.Transform(Type.String({ minLength: 1 }))
      .Decode((value) => {
         const port = parseInt(value);
         if (isNaN(port)) {
            throw new Error("POSTGRES_PORT must be a number");
         }

         return port;
      })
      .Encode((value) => value.toString()),
});

export async function readConfig() {
   const { VALNOR_ENV_PATH } = Value.Decode(Env, process.env);
   const env = await loadEnv({
      filePath: VALNOR_ENV_PATH,
      environments: ["postgres"],
   });

   console.log({ env });

   return Value.Decode(Config, process.env);
}

export const { POSTGRES_USER, POSTGRES_DATABASE, POSTGRES_PASSWORD, POSTGRES_HOST, POSTGRES_PORT } = await readConfig();

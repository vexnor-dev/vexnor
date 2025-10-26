import { Type } from "@sinclair/typebox";
import { Value } from "@sinclair/typebox/value";
import { loadEnv } from "@valnor/test-utils";

await loadEnv({
   filePath: "../../env-dev.json",
   environments: ["postgres"],
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

export const { POSTGRES_USER, POSTGRES_DATABASE, POSTGRES_PASSWORD, POSTGRES_HOST, POSTGRES_PORT } = Value.Decode(
   Config,
   process.env,
);

import { Type } from "@sinclair/typebox";
import { Value } from "@sinclair/typebox/value";

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
   SQLITE_PATH: Type.String({ minLength: 1 }),
});

export const { POSTGRES_USER, POSTGRES_DATABASE, POSTGRES_PASSWORD, POSTGRES_HOST, POSTGRES_PORT, SQLITE_PATH } = Value.Decode(
   Config,
   process.env,
);

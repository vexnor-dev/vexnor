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
   MSSQL_DATABASE: Type.String({ minLength: 1 }),
   MSSQL_USER: Type.String({ minLength: 1 }),
   MSSQL_PASSWORD: Type.String({ minLength: 1 }),
   SQLITE_PATH: Type.String({ minLength: 1 }),
});

export const { POSTGRES_USER, POSTGRES_DATABASE, POSTGRES_PASSWORD, POSTGRES_HOST, POSTGRES_PORT, MSSQL_HOST, MSSQL_PORT, MSSQL_DATABASE, MSSQL_USER, MSSQL_PASSWORD, SQLITE_PATH } = Value.Decode(
   Config,
   process.env,
);

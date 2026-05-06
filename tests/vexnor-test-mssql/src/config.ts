import { Type } from "@sinclair/typebox";
import { Value } from "@sinclair/typebox/value";

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

export const { MSSQL_USER, MSSQL_DATABASE, MSSQL_PORT, MSSQL_HOST, MSSQL_PASSWORD } = Value.Decode(Config, process.env);

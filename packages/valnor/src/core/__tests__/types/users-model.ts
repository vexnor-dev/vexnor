import { newTable } from "../../index.js";

export const Users = newTable(
   {
      name: "users",
      schema: "public",
      alias: "users_1",
      types: <{ Insert: IUsersInsert; Update: IUsersUpdate }>{},
   },
   {
      userId: "user_id",
      name: "name",
      email: "email",
      age: "age",
      city: "city",
      password: "password",
      createdAt: "created_at",
      updatedAt: "updated_at",
   },
);

export type IUsersInsert = {
   userId?: number;
   name: string;
   email: string;
   age: number;
   city: string;
   password: string;
   createdAt?: Date;
   updatedAt?: Date;
};

export type IUsersSelect = {
   userId: number;
   name: string;
   email: string;
   age: number;
   city: string;
   password: string;
   createdAt: Date;
   updatedAt: Date;
};

export type IUsersUpdate = {
   userId?: number;
   name?: string;
   email?: string;
   age?: number;
   city?: string;
   password?: string;
   createdAt?: Date;
   updatedAt?: Date;
};

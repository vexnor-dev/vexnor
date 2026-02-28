import { AccountStatusUdt } from "./valnor_test-enums.js";
import { JsonRow, newSqlTable } from "../../schema/index.js";

export const Account = newSqlTable<{
   Select: IAccountSelect;
   Insert: IAccountInsert;
   Update: IAccountUpdate;
   Delete: true;
}>({
   crud: {
      find: true,
      create: true,
      update: true,
      delete: true,
   },
   tableInfo: {
      name: "account",
      schema: "valnor_test",
   },
   pk: ["accountId"],
   columns: {
      /**
       * account_id uuid default gen_random_uuid()
       */
      accountId: "account_id",

      /**
       * status account_status default 'created'::valnor_test.account_status
       */
      status: "status",

      /**
       * email varchar
       */
      email: "email",

      /**
       * first_name varchar
       */
      firstName: "first_name",

      /**
       * last_name varchar
       */
      lastName: "last_name",

      /**
       * notes text
       */
      notes: "notes",

      /**
       * created_at timestamptz default now()
       */
      createdAt: "created_at",

      /**
       * modified_at timestamptz default now()
       */
      modifiedAt: "modified_at",

      /**
       * parent_id uuid
       */
      parentId: "parent_id",
   },
});

export type IAccountInsert = {
   accountId?: string;
   status?: AccountStatusUdt;
   email: string;
   firstName: string;
   lastName: string;
   notes?: string | null;
   createdAt?: Date;
   modifiedAt?: Date;
   parentId?: string | null;
};

export type IAccountUpdate = Partial<IAccountInsert>;

export type IAccountSelect = {
   readonly accountId: string;
   readonly status: AccountStatusUdt;
   readonly email: string;
   readonly firstName: string;
   readonly lastName: string;
   readonly notes: string | null;
   readonly createdAt: Date;
   readonly modifiedAt: Date;
   readonly parentId: string | null;
};

export type IAccountJson = JsonRow<IAccountSelect>;

import { JsonRow } from "#/core/schema/schema-types.js";
import { newSqlTable } from "#/core/schema/sql-table.js";
import { AccountStatusUdt } from "#/test/models/vexnor_dev-enums.js";

export const Account = newSqlTable<{
   Select: IAccountSelect;
   Insert: IAccountInsert;
   Update: IAccountUpdate;
   Delete: true;
}>({
   crud: {
      select: true,
      insert: true,
      update: true,
      delete: true,
   },
   tableInfo: {
      name: "account",
      schema: "main",
      out: false,
      alias: null,
   },
   pk: ["accountId"],
   columns: {
      /**
       * account_id uuid default gen_random_uuid()
       */
      accountId: "account_id",

      /**
       * status account_status default 'created'::vexnor_dev.account_status
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
   accountId: string;
   status: AccountStatusUdt;
   email: string;
   firstName: string;
   lastName: string;
   notes: string | null;
   createdAt: Date;
   modifiedAt: Date;
   parentId: string | null;
};

export type IAccountJson = JsonRow<IAccountSelect>;

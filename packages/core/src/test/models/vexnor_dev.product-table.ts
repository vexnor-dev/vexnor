import { JsonRow } from "#src/core/schema/schema-types.js";
import { newSqlTable } from "#src/core/schema/sql-table.js";

export const Product = newSqlTable<{
   Select: IProductSelect;
   Insert: IProductInsert;
   Update: IProductUpdate;
   Delete: true;
}>({
   crud: {
      select: true,
      insert: true,
      update: true,
      delete: true,
   },
   tableInfo: {
      name: "product",
      schema: "main",
      out: false,
      alias: null,
   },
   pk: ["productId"],
   jsonSchema: {
      createdAt: "Date",
      modifiedAt: "Date",
   },
   columns: {
      /**
       * product_id uuid default gen_random_uuid()
       */
      productId: "product_id",

      /**
       * discount numeric
       */
      discount: "discount",

      /**
       * is_available bool default true
       */
      isAvailable: "is_available",

      /**
       * is_published bool default false
       */
      isPublished: "is_published",

      /**
       * label varchar
       */
      label: "label",

      /**
       * created_at timestamptz default now()
       */
      createdAt: "created_at",

      /**
       * modified_at timestamptz default now()
       */
      modifiedAt: "modified_at",

      /**
       * price numeric
       */
      price: "price",
   },
});

export type IProductInsert = {
   productId?: string;
   discount?: string | null;
   isAvailable?: boolean;
   isPublished?: boolean;
   label: string;
   createdAt?: Date;
   modifiedAt?: Date;
   price: string;
};

export type IProductUpdate = Partial<IProductInsert>;

export type IProductSelect = {
   productId: string;
   discount: string | null;
   isAvailable: boolean;
   isPublished: boolean;
   label: string;
   createdAt: Date;
   modifiedAt: Date;
   price: string;
};

export type IProductJson = JsonRow<IProductSelect>;

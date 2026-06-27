import { JsonRow } from "#src/core/schema/schema-types.js";
import { newSqlTable } from "#src/core/schema/sql-table.js";

export const OrderItem = newSqlTable<{
   Select: IOrderItemSelect;
   Insert: IOrderItemInsert;
   Update: IOrderItemUpdate;
   Delete: true;
}>({
   crud: {
      select: true,
      insert: true,
      update: true,
      delete: true,
   },
   tableInfo: { name: "order_item", schema: "main", out: false, alias: null },
   pk: ["orderId", "productId"],
   columns: {
      /**
       * product_price numeric
       */
      productPrice: "product_price",

      /**
       * order_item_id uuid default gen_random_uuid()
       */
      orderItemId: "order_item_id",

      /**
       * quantity int4
       */
      quantity: "quantity",

      /**
       * discount_price numeric
       */
      discountPrice: "discount_price",

      /**
       * modified_at timestamptz
       */
      modifiedAt: "modified_at",

      /**
       * created_at timestamptz
       */
      createdAt: "created_at",

      /**
       * order_id uuid
       */
      orderId: "order_id",

      /**
       * product_id uuid
       */
      productId: "product_id",
   },
});

export type IOrderItemInsert = {
   productPrice: string;
   orderItemId?: string;
   quantity: number;
   discountPrice?: string | null;
   modifiedAt: Date;
   createdAt: Date;
   orderId: string;
   productId: string;
};

export type IOrderItemUpdate = Partial<IOrderItemInsert>;

export type IOrderItemSelect = {
   productPrice: string;
   orderItemId: string;
   quantity: number;
   discountPrice: string | null;
   modifiedAt: Date;
   createdAt: Date;
   orderId: string;
   productId: string;
};

export type IOrderItemJson = JsonRow<IOrderItemSelect>;

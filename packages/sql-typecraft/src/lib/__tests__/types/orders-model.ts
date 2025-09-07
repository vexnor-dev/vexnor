import { newTable } from "../../index.js";

export const Orders = newTable(
   {
      name: "orders",
      schema: "public",
      alias: "orders_1",
      types: <{ Insert: IOrdersInsert; Update: IOrdersUpdate }>{},
   },
   {
      orderId: "order_id",
      total: "total",
      userId: "user_id",
      status: "status",
      createdAt: "created_at",
      updatedAt: "updated_at",
   },
);

export enum OrderStatus {
   Created = "created",
   Pending = "pending",
   Shipped = "shipped",
   Delivered = "delivered",
   Cancelled = "cancelled",
}

export type IOrdersInsert = {
   orderId?: number;
   total: number;
   userId: number;
   status?: OrderStatus;
   createdAt?: Date;
   updatedAt?: Date;
};

export type IOrdersSelect = {
   orderId: number;
   total: number;
   userId: number;
   createdAt: Date;
   updatedAt: Date;
};

export type IOrdersUpdate = {
   orderId?: number;
   total?: number;
   userId?: number;
   createdAt?: Date;
   updatedAt?: Date;
};

export const AccountStatusUdt = {
   CREATED: 'created',
   CONFIRMED: 'confirmed',
   DELETED: 'deleted',
} as const;
export type AccountStatusUdt = (typeof AccountStatusUdt)[keyof typeof AccountStatusUdt];
export const OrderStatusUdt = {
   CREATED: 'created',
   PAID: 'paid',
   DELIVERED: 'delivered',
   RECEIVED: 'received',
} as const;
export type OrderStatusUdt = (typeof OrderStatusUdt)[keyof typeof OrderStatusUdt];

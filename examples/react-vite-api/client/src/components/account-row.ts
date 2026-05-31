export type AccountRow = {
   accountId: string;
   email: string;
   firstName: string;
   lastName: string;
   status: string;
   createdAt: Date | string;
   orderCount: number | string;
   lastOrder: { orderId: string | null; status: string; createdAt: Date | string; productCount: number } | null;
};

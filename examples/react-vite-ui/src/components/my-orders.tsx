import { Suspense, use } from "react";

export type MyOrder = {
   orderId: string | null;
   status: string;
   createdAt: string | Date;
   items: { quantity: number }[];
};

function MyOrdersTable({ promise }: { promise: Promise<MyOrder[]> }) {
   const orders = use(promise);

   return (
      <div className="table-wrap">
         <table>
            <thead>
               <tr>
                  <th>Order ID</th>
                  <th>Status</th>
                  <th>Created</th>
                  <th>Items</th>
               </tr>
            </thead>
            <tbody>
               {orders.length === 0 ? (
                  <tr className="empty-row">
                     <td colSpan={4}>No orders for this account.</td>
                  </tr>
               ) : orders.map((order, i) => (
                  <tr key={order.orderId ?? i}>
                     <td><code style={{ fontSize: 12 }}>{order.orderId}</code></td>
                     <td><span className="badge">{order.status}</span></td>
                     <td>{new Date(order.createdAt).toLocaleDateString("en-CA")}</td>
                     <td>{order.items.length}</td>
                  </tr>
               ))}
            </tbody>
         </table>
      </div>
   );
}

export function MyOrders({ promise }: { promise: Promise<MyOrder[]> }) {
   return (
      <section>
         <p className="login-hint" style={{ marginBottom: 16 }}>
            These orders are filtered server-side using <code>runtime("userId")</code> — the client never sends the user ID as a param.
         </p>
         <Suspense fallback={<p className="loading">Loading orders…</p>}>
            <MyOrdersTable promise={promise} />
         </Suspense>
      </section>
   );
}

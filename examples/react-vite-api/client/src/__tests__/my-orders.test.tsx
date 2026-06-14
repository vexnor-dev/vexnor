import { describe, test, expect, vi } from "vitest";
import { render, screen, waitFor, act } from "@testing-library/react";
import { Suspense } from "react";
import "@vexnor/sqlite3";
import { AuthProvider } from "#/auth-context.js";

vi.mock("#/use-remote-client.js", () => ({
   useRemoteClient: () => ({ remoteExecute: vi.fn() }),
}));

const { MyOrders } = await import("#/components/my-orders.js");

const mockOrders = [
   {
      orderId: "order-1",
      status: "delivered",
      createdAt: "2024-01-10T00:00:00.000Z",
      items: [{ quantity: 2 }, { quantity: 1 }],
   },
   {
      orderId: "order-2",
      status: "pending",
      createdAt: "2024-01-15T00:00:00.000Z",
      items: [],
   },
];

function renderComponent(orders = mockOrders) {
   const promise = Promise.resolve(orders) as Parameters<typeof MyOrders>[0]["promise"];
   return render(
      <AuthProvider>
         <Suspense fallback={<p>Loading...</p>}>
            <MyOrders promise={promise} />
         </Suspense>
      </AuthProvider>,
   );
}

describe("MyOrders", () => {
   test("renders orders after loading", async () => {
      const { asFragment } = await act(async () => renderComponent());
      await waitFor(() => screen.getByText("delivered"));
      expect(asFragment()).toMatchInlineSnapshot(`
        <DocumentFragment>
          <section>
            <p
              class="login-hint"
              style="margin-bottom: 16px;"
            >
              These orders are filtered server-side using 
              <code>
                runtime("userId")
              </code>
               — the client never sends the user ID as a param.
            </p>
            <div
              class="table-wrap"
            >
              <table>
                <thead>
                  <tr>
                    <th>
                      Order ID
                    </th>
                    <th>
                      Status
                    </th>
                    <th>
                      Created
                    </th>
                    <th>
                      Items
                    </th>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td>
                      <code
                        style="font-size: 12px;"
                      >
                        order-1
                      </code>
                    </td>
                    <td>
                      <span
                        class="badge"
                      >
                        delivered
                      </span>
                    </td>
                    <td>
                      2024-01-10
                    </td>
                    <td>
                      2
                    </td>
                  </tr>
                  <tr>
                    <td>
                      <code
                        style="font-size: 12px;"
                      >
                        order-2
                      </code>
                    </td>
                    <td>
                      <span
                        class="badge"
                      >
                        pending
                      </span>
                    </td>
                    <td>
                      2024-01-15
                    </td>
                    <td>
                      0
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </section>
        </DocumentFragment>
      `);
   });

   test("renders item counts", async () => {
      await act(async () => renderComponent());
      await waitFor(() => screen.getByText("delivered"));
      const cells = screen.getAllByRole("cell");
      expect(cells.map((c) => c.textContent)).toMatchInlineSnapshot(`
        [
          "order-1",
          "delivered",
          "2024-01-10",
          "2",
          "order-2",
          "pending",
          "2024-01-15",
          "0",
        ]
      `);
   });

   test("renders empty state when no orders", async () => {
      await act(async () => renderComponent([]));
      await waitFor(() => screen.getByText("No orders for this account."));
   });
});

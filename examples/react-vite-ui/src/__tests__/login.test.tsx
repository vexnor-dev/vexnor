import { describe, test, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor, act } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Suspense } from "react";
import "@vexnor/sqlite3";
import { AuthProvider } from "#/auth-context.js";

const mockRemoteExecute = vi.fn();

vi.mock("#/remote-client.js", () => ({
   remoteClient: { remoteExecute: mockRemoteExecute },
}));

const mockNavigate = vi.fn();
vi.mock("@tanstack/react-router", async (importActual) => ({
   ...(await importActual<typeof import("@tanstack/react-router")>()),
   useNavigate: () => mockNavigate,
}));

const { default: Sqlite3LoginPage } = await import("#/pages/sqlite3-login.js");

const mockLoginAccounts = [
   {
      accountId: "acc-1",
      email: "alice@example.com",
      firstName: "Alice",
      lastName: "Smith",
      status: "confirmed",
      notes: null,
      createdAt: "2024-01-01T00:00:00.000Z",
      modifiedAt: "2024-01-01T00:00:00.000Z",
      parentId: null,
      orders: [
         { orderId: "o-1", status: "delivered", createdAt: "2024-01-10T00:00:00.000Z", modifiedAt: "2024-01-10T00:00:00.000Z", accountId: "acc-1", productCount: 3 },
         { orderId: "o-2", status: "pending", createdAt: "2024-01-15T00:00:00.000Z", modifiedAt: "2024-01-15T00:00:00.000Z", accountId: "acc-1", productCount: 1 },
      ],
   },
   {
      accountId: "acc-2",
      email: "bob@example.com",
      firstName: "Bob",
      lastName: "Jones",
      status: "created",
      notes: null,
      createdAt: "2024-01-02T00:00:00.000Z",
      modifiedAt: "2024-01-02T00:00:00.000Z",
      parentId: null,
      orders: [],
   },
];

function renderPage() {
   return render(
      <AuthProvider>
         <Suspense fallback={<p>Loading...</p>}>
            <Sqlite3LoginPage />
         </Suspense>
      </AuthProvider>,
   );
}

beforeEach(() => {
   vi.clearAllMocks();
   mockRemoteExecute.mockResolvedValue({ rows: mockLoginAccounts });
});

describe("Sqlite3LoginPage", () => {
   test("renders the sign in heading", async () => {
      await act(async () => renderPage());
      expect(screen.getByRole("heading", { name: "Sign in — SQLite3" })).toBeDefined();
   });

   test("renders account list after loading", async () => {
      const { asFragment } = await act(async () => renderPage());
      await waitFor(() => screen.getByText("alice@example.com"));
      expect(asFragment()).toMatchInlineSnapshot(`
        <DocumentFragment>
          <div
            class="page"
          >
            <h1>
              Sign in — SQLite3
            </h1>
            <p
              class="login-hint"
            >
              Pick an account to sign in as. This is a demo — the selected 
              <code>
                account_id
              </code>
               becomes the runtime 
              <code>
                userId
              </code>
               injected server-side into queries that use 
              <code>
                runtime("userId")
              </code>
              .
            </p>
            <div
              class="table-wrap"
            >
              <table>
                <thead>
                  <tr>
                    <th>
                      Email
                    </th>
                    <th>
                      First Name
                    </th>
                    <th>
                      Last Name
                    </th>
                    <th>
                      Orders
                    </th>
                    <th />
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td>
                      alice@example.com
                    </td>
                    <td>
                      Alice
                    </td>
                    <td>
                      Smith
                    </td>
                    <td>
                      2
                    </td>
                    <td>
                      <button
                        class="btn btn-primary"
                      >
                        Sign in as
                      </button>
                    </td>
                  </tr>
                  <tr>
                    <td>
                      bob@example.com
                    </td>
                    <td>
                      Bob
                    </td>
                    <td>
                      Jones
                    </td>
                    <td>
                      0
                    </td>
                    <td>
                      <button
                        class="btn btn-primary"
                      >
                        Sign in as
                      </button>
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        </DocumentFragment>
      `);
   });

   test("renders order counts", async () => {
      await act(async () => renderPage());
      await waitFor(() => screen.getByText("alice@example.com"));
      expect(screen.getByText("2")).toBeDefined(); // Alice has 2 orders
      expect(screen.getByText("0")).toBeDefined(); // Bob has 0 orders
   });

   test("calls remoteExecute with @vexnor/sqlite3 plugin", async () => {
      await act(async () => renderPage());
      await waitFor(() => screen.getByText("alice@example.com"));
      expect(mockRemoteExecute).toHaveBeenCalledWith(expect.objectContaining({ plugin: "@vexnor/sqlite3" }));
   });

   test("renders empty state when no accounts", async () => {
      mockRemoteExecute.mockResolvedValue({ rows: [] });
      await act(async () => renderPage());
      await waitFor(() => screen.getByText("No accounts found."));
   });

   test("clicking Sign in as navigates to /sqlite3", async () => {
      const user = userEvent.setup();
      await act(async () => renderPage());
      await waitFor(() => screen.getByText("alice@example.com"));

      const buttons = screen.getAllByRole("button", { name: "Sign in as" });
      await user.click(buttons[0]!);

      expect(mockNavigate).toHaveBeenCalledWith(expect.objectContaining({ to: "/sqlite3" }));
   });

   test("clicking Sign in as disables that button", async () => {
      const user = userEvent.setup();
      await act(async () => renderPage());
      await waitFor(() => screen.getByText("alice@example.com"));

      const buttons = screen.getAllByRole("button", { name: "Sign in as" });
      await user.click(buttons[0]!);

      expect(buttons[0]!.hasAttribute("disabled")).toBe(true);
   });
});

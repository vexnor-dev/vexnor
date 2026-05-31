import { describe, test, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor, act } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Suspense } from "react";
import "vexnor-mssql";
import type { IAccountSelect } from "#shared/codegen/mssql/vexnor_dev.account-table";
import { AuthProvider } from "#/auth-context.js";

const mockRemoteExecute = vi.fn();
const mockRemoteClient = { remoteExecute: mockRemoteExecute };

vi.mock("#/use-remote-client.js", () => ({
   useRemoteClient: () => mockRemoteClient,
}));

vi.mock("@tanstack/react-router", async (importActual) => ({
   ...(await importActual<typeof import("@tanstack/react-router")>()),
   useSearch: () => ({ filter: undefined }),
}));

vi.mock("#/components/search-input.js", () => ({
   SearchInput: () => null,
}));

const { default: MssqlAccountsPage } = await import("#/pages/mssql-accounts.js");

const mockAccounts: (IAccountSelect & { orderCount: number; lastOrder: { orderId: string; status: string; createdAt: Date; productCount: number } | null })[] = [
   {
      accountId: "1",
      email: "alice@example.com",
      firstName: "Alice",
      lastName: "Smith",
      status: "confirmed",
      notes: null,
      createdAt: new Date("2024-01-01"),
      modifiedAt: new Date("2024-01-01"),
      parentId: null,
      orderCount: 3,
      lastOrder: { orderId: "o1", status: "delivered", createdAt: new Date("2024-01-10"), productCount: 2 },
   },
   {
      accountId: "2",
      email: "bob@example.com",
      firstName: "Bob",
      lastName: "Jones",
      status: "created",
      notes: null,
      createdAt: new Date("2024-01-02"),
      modifiedAt: new Date("2024-01-02"),
      parentId: null,
      orderCount: 0,
      lastOrder: null,
   },
];

function renderPage() {
   return render(
      <AuthProvider>
         <Suspense fallback={<p>Loading...</p>}>
            <MssqlAccountsPage />
         </Suspense>
      </AuthProvider>,
   );
}

beforeEach(() => {
   vi.clearAllMocks();
   mockRemoteExecute.mockResolvedValue({ recordset: mockAccounts });
});

describe("MssqlAccountsPage", () => {
   test("renders accounts", async () => {
      const { asFragment } = await act(async () => renderPage());
      await waitFor(() => screen.getByText("alice@example.com"));
      expect(asFragment()).toMatchInlineSnapshot(`
        <DocumentFragment>
          <div
            class="page"
          >
            <h1>
              Accounts — MS SQL Server
            </h1>
            <form
              action="javascript:throw new Error('A React form was unexpectedly submitted. If you called form.submit() manually, consider using form.requestSubmit() instead. If you\\'re trying to use event.stopPropagation() in a submit event handler, consider also calling event.preventDefault().')"
              class="form"
            >
              <input
                name="email"
                placeholder="Email"
                required=""
              />
              <input
                name="firstName"
                placeholder="First name"
                required=""
              />
              <input
                name="lastName"
                placeholder="Last name"
                required=""
              />
              <button
                class="btn btn-primary"
                type="submit"
              >
                Create
              </button>
            </form>
            <div
              class="table-wrap"
            >
              <table
                style="opacity: 1;"
              >
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
                      Status
                    </th>
                    <th>
                      Created At
                    </th>
                    <th>
                      Orders
                    </th>
                    <th>
                      Last Order
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
                      <span
                        class="badge"
                      >
                        confirmed
                      </span>
                    </td>
                    <td>
                      2024-01-01
                    </td>
                    <td>
                      3
                    </td>
                    <td>
                      <div
                        class="last-order"
                      >
                        <span
                          class="last-order-status"
                        >
                          delivered
                        </span>
                        <span
                          class="last-order-meta"
                        >
                          2024-01-10 · 2 products
                        </span>
                      </div>
                    </td>
                    <td>
                      <button
                        class="btn btn-danger"
                        disabled=""
                      >
                        Delete
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
                      <span
                        class="badge"
                      >
                        created
                      </span>
                    </td>
                    <td>
                      2024-01-02
                    </td>
                    <td>
                      0
                    </td>
                    <td>
                      —
                    </td>
                    <td>
                      <button
                        class="btn btn-danger"
                      >
                        Delete
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

   test("calls remoteExecute with correct plugin on load", async () => {
      await act(async () => renderPage());
      await waitFor(() => screen.getByText("alice@example.com"));
      expect(vi.mocked(mockRemoteExecute)).toHaveBeenCalledWith(
         expect.objectContaining({ plugin: "vexnor-mssql" }),
      );
   });

   test("delete calls remoteExecute and refreshes list", async () => {
      const user = userEvent.setup();
      await act(async () => renderPage());
      await waitFor(() => screen.getByText("alice@example.com"));

      const deleteButtons = screen.getAllByText("Delete");
      await user.click(deleteButtons[1]!);

      await waitFor(() =>
         expect(vi.mocked(mockRemoteExecute)).toHaveBeenCalledTimes(3),
      );
   });

   test("create form submits and refreshes list", async () => {
      const user = userEvent.setup();
      await act(async () => renderPage());
      await waitFor(() => screen.getByText("alice@example.com"));

      await user.type(screen.getByPlaceholderText("Email"), "new@example.com");
      await user.type(screen.getByPlaceholderText("First name"), "New");
      await user.type(screen.getByPlaceholderText("Last name"), "User");
      await user.click(screen.getByRole("button", { name: "Create" }));

      await waitFor(() =>
         expect(vi.mocked(mockRemoteExecute)).toHaveBeenCalledTimes(3),
      );
   });
});

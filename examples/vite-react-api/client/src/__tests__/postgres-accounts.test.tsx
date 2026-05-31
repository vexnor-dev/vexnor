import { describe, test, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor, act } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Suspense } from "react";
import "vexnor-postgres";
import { AccountStatusUdt } from "#shared/codegen/postgres/vexnor_dev-enums";
import type { IAccountSelect } from "#shared/codegen/postgres/vexnor_dev.account-table";

vi.mock("#/remote-client.js", () => ({
   remoteClient: {
      remoteExecute: vi.fn(),
   },
}));

const { remoteClient } = await import("#/remote-client.js");
const { default: PostgresAccountsPage } = await import("#/pages/postgres-accounts.js");

const mockAccounts: (IAccountSelect & { orderCount: number; lastOrder: { orderId: string; status: string; createdAt: Date; productCount: number } | null })[] = [
   {
      accountId: "1",
      email: "alice@example.com",
      firstName: "Alice",
      lastName: "Smith",
      status: AccountStatusUdt.CONFIRMED,
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
      status: AccountStatusUdt.CREATED,
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
      <Suspense fallback={<p>Loading...</p>}>
         <PostgresAccountsPage />
      </Suspense>,
   );
}

beforeEach(() => {
   vi.clearAllMocks();
   vi.mocked(remoteClient.remoteExecute).mockResolvedValue({ rows: mockAccounts });
});

describe("PostgresAccountsPage", () => {
   test("renders accounts", async () => {
      const { asFragment } = await act(async () => renderPage());
      await waitFor(() => screen.getByText("alice@example.com"));
      expect(asFragment()).toMatchInlineSnapshot(`
        <DocumentFragment>
          <h1>
            Accounts (PostgreSQL)
          </h1>
          <form
            action="javascript:throw new Error('A React form was unexpectedly submitted. If you called form.submit() manually, consider using form.requestSubmit() instead. If you\\'re trying to use event.stopPropagation() in a submit event handler, consider also calling event.preventDefault().')"
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
              type="submit"
            >
              Create
            </button>
          </form>
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
                  Status
                </th>
                <th>
                  Created At
                </th>
                <th>
                  Orders #
                </th>
                <th>
                  Last Order
                </th>
                <th />
              </tr>
            </thead>
            <tbody
              style="opacity: 1;"
            >
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
                  confirmed
                </td>
                <td>
                  1/1/2024, 1:00:00 AM
                </td>
                <td>
                  3
                </td>
                <td>
                  delivered — 1/10/2024 (2 products)
                </td>
                <td>
                  <button>
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
                  created
                </td>
                <td>
                  1/2/2024, 1:00:00 AM
                </td>
                <td>
                  0
                </td>
                <td>
                  —
                </td>
                <td>
                  <button>
                    Delete
                  </button>
                </td>
              </tr>
            </tbody>
          </table>
        </DocumentFragment>
      `);
   });

   test("calls remoteExecute with correct plugin on load", async () => {
      await act(async () => renderPage());
      await waitFor(() => screen.getByText("alice@example.com"));
      expect(vi.mocked(remoteClient.remoteExecute)).toHaveBeenCalledWith(
         expect.objectContaining({ plugin: "vexnor-postgres" }),
      );
   });

   test("delete calls remoteExecute and refreshes list", async () => {
      const user = userEvent.setup();
      await act(async () => renderPage());
      await waitFor(() => screen.getByText("alice@example.com"));

      const deleteButtons = screen.getAllByText("Delete");
      await user.click(deleteButtons[0]!);

      await waitFor(() =>
         expect(vi.mocked(remoteClient.remoteExecute)).toHaveBeenCalledTimes(3),
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
         expect(vi.mocked(remoteClient.remoteExecute)).toHaveBeenCalledTimes(3),
      );
   });
});

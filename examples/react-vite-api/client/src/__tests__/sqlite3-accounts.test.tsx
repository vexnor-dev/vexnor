import { describe, test, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor, act } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Suspense } from "react";
import "vexnor-sqlite3";
import type { IAccountSelect } from "#shared/codegen/sqlite3/main.account-table";

vi.mock("#/remote-client.js", () => ({
   remoteClient: {
      remoteExecute: vi.fn(),
   },
}));

const { remoteClient } = await import("#/remote-client.js");
const { default: Sqlite3AccountsPage } = await import("#/pages/sqlite3-accounts.js");

const mockAccounts: (IAccountSelect & {
   orderCount: number;
   lastOrder: { orderId: string; status: string; createdAt: Date; productCount: number } | null;
})[] = [
   {
      accountId: "1",
      email: "alice@example.com",
      firstName: "Alice",
      lastName: "Smith",
      status: "confirmed",
      notes: null,
      createdAt: "2024-01-01T00:00:00.000Z",
      modifiedAt: "2024-01-01T00:00:00.000Z",
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
      createdAt: "2024-01-02T00:00:00.000Z",
      modifiedAt: "2024-01-02T00:00:00.000Z",
      parentId: null,
      orderCount: 0,
      lastOrder: null,
   },
];

function renderPage() {
   return render(
      <Suspense fallback={<p>Loading...</p>}>
         <Sqlite3AccountsPage />
      </Suspense>,
   );
}

beforeEach(() => {
   vi.clearAllMocks();
   vi.mocked(remoteClient.remoteExecute).mockResolvedValue({ rows: mockAccounts });
});

describe("Sqlite3AccountsPage", () => {
   test("renders accounts", async () => {
      await act(async () => renderPage());
      await waitFor(() => screen.getByText("alice@example.com"));
      expect(screen.getByRole("heading", { name: "Accounts (SQLite3)" })).toBeDefined();
   });

   test("calls remoteExecute with correct plugin on load", async () => {
      await act(async () => renderPage());
      await waitFor(() => screen.getByText("alice@example.com"));
      expect(vi.mocked(remoteClient.remoteExecute)).toHaveBeenCalledWith(
         expect.objectContaining({ plugin: "vexnor-sqlite3" }),
      );
   });

   test("delete calls remoteExecute and refreshes list", async () => {
      const user = userEvent.setup();
      await act(async () => renderPage());
      await waitFor(() => screen.getByText("alice@example.com"));

      const deleteButtons = screen.getAllByText("Delete");
      await user.click(deleteButtons[0]!);

      await waitFor(() => expect(vi.mocked(remoteClient.remoteExecute)).toHaveBeenCalledTimes(3));
   });

   test("create form submits and refreshes list", async () => {
      const user = userEvent.setup();
      await act(async () => renderPage());
      await waitFor(() => screen.getByText("alice@example.com"));

      await user.type(screen.getByPlaceholderText("Email"), "new@example.com");
      await user.type(screen.getByPlaceholderText("First name"), "New");
      await user.type(screen.getByPlaceholderText("Last name"), "User");
      await user.click(screen.getByRole("button", { name: "Create" }));

      await waitFor(() => expect(vi.mocked(remoteClient.remoteExecute)).toHaveBeenCalledTimes(3));
   });
});

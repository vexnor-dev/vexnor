import "@vexnor/duckdb";
import { act, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Suspense } from "react";
import { beforeEach, describe, expect, test, vi } from "vitest";
import type { IAccountSelect } from "#shared/codegen/duckdb/main.account-table";
import { AuthProvider } from "#src/auth-context.js";

const mockRemoteExecute = vi.fn();
const mockRemoteClient = { remoteExecute: mockRemoteExecute };

vi.mock("#src/use-remote-client.js", () => ({ useRemoteClient: () => mockRemoteClient }));
vi.mock("#src/remote-client.js", () => ({ remoteClient: mockRemoteClient }));

const mockNavigate = vi.fn();
vi.mock("@tanstack/react-router", async (importActual) => ({
   ...(await importActual<typeof import("@tanstack/react-router")>()),
   useSearch: () => ({ filter: undefined }),
   useNavigate: () => mockNavigate,
}));

vi.mock("#src/components/search-input.js", () => ({ SearchInput: () => null }));

const { default: DuckDBAccountsPage } = await import("#src/pages/duckdb-accounts.js");
const { default: DuckDBLoginPage } = await import("#src/pages/duckdb-login.js");

const account: IAccountSelect & {
   orderCount: number;
   lastOrder: null;
   orders: [];
} = {
   accountId: "00000000-0000-0000-0000-000000000001",
   email: "duck@example.com",
   firstName: "Ducky",
   lastName: "Data",
   status: "confirmed",
   notes: null,
   createdAt: new Date("2024-01-01"),
   modifiedAt: new Date("2024-01-01"),
   parentId: null,
   orderCount: 0,
   lastOrder: null,
   orders: [],
};

const duckResult = () => ({ rows: [account], rowCount: 1, rowsChanged: 0, statementType: 1 });

beforeEach(() => {
   vi.clearAllMocks();
   mockRemoteExecute.mockResolvedValue(duckResult());
});

describe("DuckDB example pages", () => {
   test("loads accounts with the DuckDB plugin", async () => {
      const user = userEvent.setup();
      await act(async () =>
         render(
            <AuthProvider>
               <Suspense>
                  <DuckDBAccountsPage />
               </Suspense>
            </AuthProvider>,
         ),
      );
      await act(async () => user.click(screen.getByRole("button", { name: "Accounts" })));
      await waitFor(() => screen.getByText("duck@example.com"));

      expect(screen.getByRole("heading").textContent).toMatchInlineSnapshot(`"DuckDB"`);
      expect(mockRemoteExecute.mock.calls.at(-1)?.[0].plugin).toMatchInlineSnapshot(`"@vexnor/duckdb"`);
   });

   test("loads the DuckDB login picker", async () => {
      await act(async () =>
         render(
            <AuthProvider>
               <Suspense>
                  <DuckDBLoginPage />
               </Suspense>
            </AuthProvider>,
         ),
      );
      await waitFor(() => screen.getByText("duck@example.com"));

      expect(screen.getByRole("heading").textContent).toMatchInlineSnapshot(`"Sign in — DuckDB"`);
      expect(mockRemoteExecute.mock.calls[0]?.[0].plugin).toMatchInlineSnapshot(`"@vexnor/duckdb"`);
   });
});

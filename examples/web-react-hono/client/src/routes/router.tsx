import { createRootRoute, createRoute, createRouter, Link, Outlet } from "@tanstack/react-router";
import PostgresAccountsPage from "../pages/postgres-accounts";
import MssqlAccountsPage from "../pages/mssql-accounts";

const rootRoute = createRootRoute({
   component: () => (
      <>
         <nav>
            <Link to="/postgres">PostgreSQL</Link>
            {" | "}
            <Link to="/mssql">MS SQL Server</Link>
         </nav>
         <Outlet />
      </>
   ),
});

const postgresRoute = createRoute({
   getParentRoute: () => rootRoute,
   path: "/postgres",
   component: PostgresAccountsPage,
});

const mssqlRoute = createRoute({
   getParentRoute: () => rootRoute,
   path: "/mssql",
   component: MssqlAccountsPage,
});

const indexRoute = createRoute({
   getParentRoute: () => rootRoute,
   path: "/",
   component: () => <p>Select a database above.</p>,
});

const routeTree = rootRoute.addChildren([indexRoute, postgresRoute, mssqlRoute]);

export const router = createRouter({ routeTree });

declare module "@tanstack/react-router" {
   interface Register {
      router: typeof router;
   }
}

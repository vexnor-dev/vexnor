import { getSelectAccountParams, SelectAccountsParams } from "@/shared/queries/postgres";
import { useSearchParams } from "next/navigation";
import { useMemo } from "react";

export function useSelectAccountParams(): SelectAccountsParams {
   const searchParams = useSearchParams();

   const filter = searchParams.get("filter") ?? undefined;
   const accountOrderBy = searchParams.get("accountOrderBy") ?? undefined;
   const orderDir = searchParams.get("orderDir") ?? undefined;

   return useMemo(
      () =>
         getSelectAccountParams({
            values: {
               filter,
               ...(accountOrderBy ? { orderBy: { [accountOrderBy]: orderDir ?? "DESC" } } : {}),
            },
         }),
      [filter, accountOrderBy, orderDir],
   );
}

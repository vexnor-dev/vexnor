import { AccountOrderBy, getSelectAccountParams, SelectAccountsParams } from "@/shared/queries/postgres";
import { useSearchParams } from "next/navigation";
import { useMemo } from "react";
import { OrderDirection } from "@/shared/queries/params";

export function useSelectAccountParams(): SelectAccountsParams {
   const searchParams = useSearchParams();

   const filter = searchParams.get("filter") ?? undefined;
   const accountOrderBy = searchParams.get("accountOrderBy") ?? undefined;
   const orderDir = searchParams.get("orderDir") ?? undefined;

   return useMemo(
      () =>
         getSelectAccountParams({
            values: { filter, accountOrderBy: accountOrderBy as AccountOrderBy, orderDir: orderDir as OrderDirection },
         }),
      [filter, accountOrderBy, orderDir],
   );
}

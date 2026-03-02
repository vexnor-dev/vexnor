// export type SqlTableQueryParams<Args> =
//    Args extends Record<string, unknown>
//       ? {
//            [K in keyof Args as ParamsOf<Args[K]> extends Record<string, unknown> ? K : never]: Args[K] extends SqlParam<
//               infer Param extends { Name: string; Type: unknown }
//            >
//               ? Param["Type"]
//               : ParamsOf<Args[K]> extends Record<string, unknown>
//                 ? ParamsOf<Args[K]>
//                 : unknown;
//         }
//       : unknown;

// export type SqlTableQueryParams<Args> =
//    Args extends Record<string, unknown>
//       ? {
//            [K in keyof Args]: unknown;
//         }
//       : unknown;

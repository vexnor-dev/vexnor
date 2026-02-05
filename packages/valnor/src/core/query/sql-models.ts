export type SqlBuildToken =
   | { type: "text"; value: string }
   | { type: "param"; name: string }
   | { type: "value"; value: unknown };

export type SqlParamFormat = (args: { name?: string; index: number }) => string;

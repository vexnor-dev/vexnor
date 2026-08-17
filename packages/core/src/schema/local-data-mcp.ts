import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import type { Transport } from "@modelcontextprotocol/sdk/shared/transport.js";
import {
   CallToolRequestSchema,
   ErrorCode,
   ListToolsRequestSchema,
   McpError,
   type CallToolResult,
   type Tool,
} from "@modelcontextprotocol/sdk/types.js";
import { Type, type Static, type TObject } from "@sinclair/typebox";
import { Value } from "@sinclair/typebox/value";
import type { LocalDataSession } from "#src/schema/local-data-session.js";
import { createLocalDataTools, type LocalDataTools } from "#src/schema/local-data-tools.js";
import {
   InvalidLocalQueryParametersError,
   LocalDataSessionBudgetError,
   LocalDataSessionCancellationError,
   LocalDataSessionClosedError,
   LocalDataSessionTimeoutError,
   MissingRelationshipPathError,
} from "#src/schema/schema-errors.js";

export const LOCAL_DATA_MCP_TOOLS = ["getSchema", "join", "fetchData"] as const;

export type LocalDataMcpTool = (typeof LOCAL_DATA_MCP_TOOLS)[number];

export type LocalDataMcpRun = {
   close(): Promise<void>;
   closed: Promise<void>;
};

const GetSchemaInput = Type.Object(
   {
      table: Type.Optional(Type.String({ minLength: 1, description: "Selected schema-qualified object identity" })),
   },
   { additionalProperties: false },
);

const JoinInput = Type.Object(
   {
      root: Type.Object(
         {
            schema: Type.String({ minLength: 1 }),
            table: Type.String({ minLength: 1 }),
         },
         { additionalProperties: false },
      ),
      targets: Type.Array(
         Type.Object(
            {
               schema: Type.String({ minLength: 1 }),
               table: Type.String({ minLength: 1 }),
               type: Type.Optional(
                  Type.Union([
                     Type.Literal("inner"),
                     Type.Literal("left"),
                     Type.Literal("right"),
                     Type.Literal("full"),
                     Type.Literal("cross"),
                  ]),
               ),
            },
            { additionalProperties: false },
         ),
         { minItems: 1 },
      ),
   },
   { additionalProperties: false },
);

const FetchDataInput = Type.Object(
   {
      plugin: Type.String({ minLength: 1 }),
      hash: Type.String({ minLength: 1 }),
      params: Type.Record(Type.String(), Type.Unknown()),
   },
   { additionalProperties: false },
);

const toolDefinitions: Record<LocalDataMcpTool, Tool> = {
   getSchema: {
      name: "getSchema",
      description: "List the selected datasource schema or inspect one selected table or view.",
      inputSchema: structuredClone(GetSchemaInput),
      annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false },
   },
   join: {
      name: "join",
      description: "Register a read-only query joining selected objects through known selected relationships.",
      inputSchema: structuredClone(JoinInput),
      annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false },
   },
   fetchData: {
      name: "fetchData",
      description: "Execute an opaque registered read query with validated structured Vexnor parameters.",
      inputSchema: structuredClone(FetchDataInput),
      annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false },
   },
};

export async function startLocalDataMcpServer({
   session,
   enabledTools,
   transport = new StdioServerTransport(),
   signal,
}: {
   session: LocalDataSession;
   enabledTools: readonly LocalDataMcpTool[];
   transport?: Transport;
   signal?: AbortSignal;
}): Promise<LocalDataMcpRun> {
   const enabled = validateEnabledTools(enabledTools);
   const tools = createLocalDataTools(session);
   const server = createServer(tools, enabled);
   let cleanupPromise: Promise<void> | null = null;
   let resolveClosed: (() => void) | undefined;
   let rejectClosed: ((error: unknown) => void) | undefined;
   const closed = new Promise<void>((resolve, reject) => {
      resolveClosed = resolve;
      rejectClosed = reject;
   });
   const cleanup = (): Promise<void> => {
      if (cleanupPromise) return cleanupPromise;
      if (signal) signal.removeEventListener("abort", abort);
      cleanupPromise = session.close();
      cleanupPromise.then(resolveClosed, rejectClosed);
      return cleanupPromise;
   };
   const close = async (): Promise<void> => {
      await server.close();
      await cleanup();
   };
   const abort = (): void => {
      void close().catch(rejectClosed);
   };
   const previousClose = transport.onclose;
   transport.onclose = () => {
      previousClose?.();
      void cleanup();
   };
   if (signal) signal.addEventListener("abort", abort, { once: true });

   try {
      if (signal?.aborted) {
         await cleanup();
         throw new LocalDataSessionCancellationError("Local data MCP server startup was cancelled");
      }
      await server.connect(transport);
   } catch (error) {
      await cleanup();
      throw error;
   }

   return { close, closed };
}

function createServer(tools: LocalDataTools, enabled: Set<LocalDataMcpTool>): Server {
   const server = new Server({ name: "vexnor-local-data", version: "1.0.0" }, { capabilities: { tools: {} } });
   server.setRequestHandler(ListToolsRequestSchema, async () => ({
      tools: LOCAL_DATA_MCP_TOOLS.filter((name) => enabled.has(name)).map((name) => toolDefinitions[name]),
   }));
   server.setRequestHandler(CallToolRequestSchema, async (request) => {
      const name = request.params.name;
      if (!isLocalDataMcpTool(name) || !enabled.has(name)) {
         throw new McpError(ErrorCode.InvalidParams, `Local data MCP tool is not enabled: ${name}`);
      }
      const args = request.params.arguments ?? {};
      switch (name) {
         case "getSchema":
            return callTool(name, GetSchemaInput, args, (input) => tools.getSchema(input));
         case "join":
            return callTool(name, JoinInput, args, (input) => tools.join(input));
         case "fetchData":
            return callTool(name, FetchDataInput, args, (input) => tools.fetchData(input));
      }
   });
   return server;
}

async function callTool<T extends TObject, TResult extends object>(
   name: LocalDataMcpTool,
   schema: T,
   args: unknown,
   execute: (input: Static<T>) => Promise<TResult>,
): Promise<CallToolResult> {
   if (!Value.Check(schema, args)) {
      const error = Value.Errors(schema, args).First();
      throw new McpError(
         ErrorCode.InvalidParams,
         `Invalid arguments for local data MCP tool ${name}${error ? ` at ${error.path || "/"}: ${error.message}` : ""}`,
      );
   }
   try {
      const result = await execute(args);
      const structuredContent = Object.fromEntries(Object.entries(result));
      return {
         content: [{ type: "text", text: JSON.stringify(result) }],
         structuredContent,
      };
   } catch (error) {
      const failure = safeToolError(error);
      return {
         content: [{ type: "text", text: JSON.stringify(failure) }],
         structuredContent: failure,
         isError: true,
      };
   }
}

function validateEnabledTools(enabledTools: readonly LocalDataMcpTool[]): Set<LocalDataMcpTool> {
   if (enabledTools.length === 0) throw new Error("Local data MCP enabled-tool allowlist cannot be empty");
   const enabled = new Set<LocalDataMcpTool>();
   for (const name of enabledTools) {
      if (!isLocalDataMcpTool(name)) throw new Error(`Unknown local data MCP tool: ${String(name)}`);
      if (enabled.has(name)) throw new Error(`Duplicate local data MCP tool: ${name}`);
      enabled.add(name);
   }
   return enabled;
}

function isLocalDataMcpTool(value: string): value is LocalDataMcpTool {
   return LOCAL_DATA_MCP_TOOLS.some((name) => name === value);
}

function safeToolError(error: unknown): { error: { code: string; name: string; message: string } } {
   if (
      error instanceof InvalidLocalQueryParametersError ||
      error instanceof MissingRelationshipPathError ||
      error instanceof LocalDataSessionBudgetError ||
      error instanceof LocalDataSessionTimeoutError ||
      error instanceof LocalDataSessionCancellationError ||
      error instanceof LocalDataSessionClosedError
   ) {
      return { error: { code: error.code, name: error.name, message: error.message } };
   }
   return { error: { code: "LOCAL_DATA_TOOL_FAILED", name: "Error", message: "Local data tool failed" } };
}

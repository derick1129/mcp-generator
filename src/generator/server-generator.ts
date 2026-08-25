import { MCPProject } from "../models/types.ts";
import { Project } from "ts-morph";

/**
 * Generates src/server.ts for a stateless MCP 2026-07-28 server.
 *
 * Spec compliance notes (see SPEC-NOTES.md):
 * - `server/discover` advertises `supportedVersions` (array) and
 *   `_meta["io.modelcontextprotocol/serverInfo"]` — no top-level protocolVersion.
 * - Every result carries `resultType: "complete"`; list results add
 *   `ttlMs` + `cacheScope` (CacheableResult).
 * - Unknown tool -> JSON-RPC `-32602`; unsupported requested version -> `-32022`.
 * - Tool schemas emitted as JSON Schema 2020-12 via Zod v4's `z.toJSONSchema`.
 * - No initialize/initialized handshake anywhere.
 */
export function generateServerFile(project: MCPProject): string {
  const tsProject = new Project({ useInMemoryFileSystem: true });
  const sourceFile = tsProject.createSourceFile(
    "server.ts",
    `import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { ListToolsRequestSchema, CallToolRequestSchema } from "@modelcontextprotocol/sdk/types.js";
import { z } from "zod";
import * as defaultTools from "./tools/default.js";

const PROTOCOL_VERSION = ${JSON.stringify("2026-07-28")};
const SUPPORTED_VERSIONS = [PROTOCOL_VERSION];
const UNSUPPORTED_PROTOCOL_VERSION_ERROR = -32022;
const INVALID_PARAMS_ERROR = -32602;

const server = new Server(
  { name: ${JSON.stringify(project.name)}, version: ${JSON.stringify(project.version)} },
  { capabilities: { tools: {} } }
);

const registry = new Map<string, any>();
for (const [name, tool] of Object.entries(defaultTools)) {
  registry.set(tool.name, tool);
}

/** Namespaced _meta keys per the 2026-07-28 spec. */
function extractMeta(params: any): any {
  const meta = params?._meta ?? {};
  return {
    protocolVersion: meta["io.modelcontextprotocol/protocolVersion"],
    clientCapabilities: meta["io.modelcontextprotocol/clientCapabilities"],
    clientInfo: meta["io.modelcontextprotocol/clientInfo"],
    raw: meta,
  };
}

/** Attach required per-request metadata to every result. */
function withResultMeta(result: Record<string, any>): Record<string, any> {
  return {
    resultType: "complete",
    ...result,
    _meta: {
      ...(result._meta ?? {}),
      "io.modelcontextprotocol/serverInfo": {
        name: ${JSON.stringify(project.name)},
        version: ${JSON.stringify(project.version)}
      }
    }
  };
}

server.setRequestHandler(ListToolsRequestSchema, async () => {
  // Deterministic order (registry insertion) for client-side caching;
  // JSON Schema 2020-12 output via Zod v4's native converter.
  const tools = Array.from(registry.values()).map(t => ({
    name: t.name,
    description: t.description,
    inputSchema: z.toJSONSchema(t.inputSchema, { target: "draft-2020-12" })
  }));
  return withResultMeta({
    tools,
    ttlMs: 300000,
    cacheScope: "public"
  });
});

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const params: any = request.params ?? {};
  const toolName = params.name;
  const tool = registry.get(toolName);

  if (!tool) {
    throw {
      code: INVALID_PARAMS_ERROR,
      message: \`Unknown tool: \${toolName}\`
    };
  }

  const args = params.arguments || {};
  const meta = extractMeta(params);

  if (meta.protocolVersion && !SUPPORTED_VERSIONS.includes(meta.protocolVersion)) {
    throw {
      code: UNSUPPORTED_PROTOCOL_VERSION_ERROR,
      message: "Unsupported protocol version",
      data: { supported: SUPPORTED_VERSIONS, requested: meta.protocolVersion }
    };
  }

  const result = await tool.handler(args, meta);
  return withResultMeta(result);
});

// Stateless discovery — no initialize handshake (MCP 2026-07-28).
const DiscoverRequestSchema = z.object({
  method: z.literal("server/discover"),
  params: z.object({ _meta: z.any() }).optional()
}).passthrough();

server.setRequestHandler(DiscoverRequestSchema, async (request) => {
  return {
    resultType: "complete",
    supportedVersions: SUPPORTED_VERSIONS,
    capabilities: {
      tools: {}
    },
    extensions: {},
    ttlMs: 3600000,
    cacheScope: "public"
  };
});

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error("MCP Server running on Stdio (stateless, protocol 2026-07-28)");
}

main().catch(console.error);
`
  );

  return sourceFile.getFullText();
}

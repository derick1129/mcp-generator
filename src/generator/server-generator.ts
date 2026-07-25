import { MCPProject } from "../models/types.ts";
import { Project } from "ts-morph";

export function generateServerFile(project: MCPProject): string {
  const tsProject = new Project({ useInMemoryFileSystem: true });
  const sourceFile = tsProject.createSourceFile(
    "server.ts",
    `import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { ListToolsRequestSchema, CallToolRequestSchema } from "@modelcontextprotocol/sdk/types.js";
import { zodToJsonSchema } from "zod-to-json-schema";
import * as defaultTools from "./tools/default.js";

const server = new Server(
  { name: ${JSON.stringify(project.name)}, version: ${JSON.stringify(project.version)} },
  { capabilities: { tools: {} } }
);

const registry = new Map<string, any>();
for (const [name, tool] of Object.entries(defaultTools)) {
  registry.set(tool.name, tool);
}

server.setRequestHandler(ListToolsRequestSchema, async () => {
  return {
    tools: Array.from(registry.values()).map(t => ({
      name: t.name,
      description: t.description,
      inputSchema: zodToJsonSchema(t.inputSchema) as any
    }))
  };
});

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const tool = registry.get(request.params.name);
  if (!tool) {
    throw new Error("Tool not found");
  }
  return await tool.handler(request.params.arguments);
});

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error("MCP Server running on Stdio");
}

main().catch(console.error);
`
  );

  return sourceFile.getFullText();
}

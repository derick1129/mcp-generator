import { MCPProject } from "../models/types.ts";
import { Project } from "ts-morph";

export function generateServerFile(project: MCPProject): string {
  const tsProject = new Project({ useInMemoryFileSystem: true });
  const sourceFile = tsProject.createSourceFile(
    "server.ts",
    `import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { ListToolsRequestSchema, CallToolRequestSchema } from "@modelcontextprotocol/sdk/types.js";
import * as defaultTools from "./tools/default.js";

const server = new Server(
  { name: ${JSON.stringify(project.name)}, version: ${JSON.stringify(project.version)} },
  { capabilities: { tools: {} } }
);

function zodToMcpSchema(zodSchema: any) {
  const properties: Record<string, any> = {};
  const required: string[] = [];
  if (zodSchema && zodSchema.shape) {
    for (const [key, value] of Object.entries(zodSchema.shape) as any[]) {
      let type = "string";
      if (value._def?.typeName === "ZodNumber" || value._def?.typeName === "ZodInteger") type = "number";
      else if (value._def?.typeName === "ZodBoolean") type = "boolean";
      else if (value._def?.typeName === "ZodArray") type = "array";
      else if (value._def?.typeName === "ZodObject") type = "object";
      
      const propDef: any = { type };
      if (value.description) {
        propDef.description = value.description;
      }
      properties[key] = propDef;
      if (typeof value.isOptional === "function" && !value.isOptional()) {
        required.push(key);
      }
    }
  }
  return {
    type: "object",
    properties,
    required: required.length > 0 ? required : undefined
  };
}

const registry = new Map<string, any>();
for (const [name, tool] of Object.entries(defaultTools)) {
  registry.set(tool.name, tool);
}

server.setRequestHandler(ListToolsRequestSchema, async () => {
  return {
    tools: Array.from(registry.values()).map(t => ({
      name: t.name,
      description: t.description,
      inputSchema: zodToMcpSchema(t.inputSchema)
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

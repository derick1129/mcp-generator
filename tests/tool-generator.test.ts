import { expect, test } from "bun:test";
import { parseOpenApiSpec } from "../src/parser/parser.ts";
import { translateToIIM } from "../src/parser/translator.ts";
import { generateServerFile } from "../src/generator/server-generator.ts";
import { generateTools } from "../src/generator/tool-generator.ts";
import { MCP_PROTOCOL_VERSION } from "../src/models/types.ts";

test("generates correct tools mapping", async () => {
  const spec = await parseOpenApiSpec("tests/fixtures/simple-spec.yaml");
  const project = translateToIIM(spec);
  const toolsMap = generateTools(project);

  expect(toolsMap.size).toBeGreaterThan(0);
  const defaultTools = toolsMap.get("default.ts");
  expect(defaultTools).toBeDefined();
  expect(defaultTools).toContain("export const getUserTool");
  expect(defaultTools).toContain("(args as any)?.[name]");
  expect(defaultTools).toContain('const path = "/users/{id}".replace');
});

test("generates main server setup file with zodToJsonSchema converter", async () => {
  const spec = await parseOpenApiSpec("tests/fixtures/simple-spec.yaml");
  const project = translateToIIM(spec);
  const serverFileStr = generateServerFile(project);

  expect(serverFileStr).toContain("new Server");
  expect(serverFileStr).toContain("ListToolsRequestSchema");
  expect(serverFileStr).toContain("toJSONSchema");
});

test("generates tool handler with request body and header/query parameter separation", async () => {
  const project = {
    name: "post-api",
    version: "1.0.0",
    protocolVersion: MCP_PROTOCOL_VERSION,
    outputDirectory: "./out",
    baseUrl: "https://api.example.com",
    securitySchemes: [],
    tools: [
      {
        name: "create-user",
        description: "Create user",
        endpoint: {
          id: "create-user",
          operationId: "createUser",
          method: "post" as const,
          path: "/users",
          summary: "Create user",
          parameters: [
            { name: "tenantId", in: "header" as const, required: true, schema: { type: "string" } },
            { name: "dryRun", in: "query" as const, required: false, schema: { type: "string" } }
          ],
          requestBody: {
            required: true,
            schema: {
              type: "object",
              properties: [{ name: "username", type: "string", required: true }]
            }
          },
          responses: []
        },
        inputSchema: { type: "object" }
      }
    ]
  };

  const toolsMap = generateTools(project);
  const defaultTools = toolsMap.get("default.ts");
  expect(defaultTools).toBeDefined();
  expect(defaultTools).toContain('const queryParamNames: string[] = ["dryRun"];');
  expect(defaultTools).toContain('const headerParamNames: string[] = ["tenantId"];');
  expect(defaultTools).toContain('const hasRequestBody = true;');
  expect(defaultTools).toContain('headers["Content-Type"] = "application/json";');
  expect(defaultTools).toContain('fetchOptions.body = JSON.stringify(body);');
});

test("generates tool handlers accepting (args, meta) metadata context", async () => {
  const spec = await parseOpenApiSpec("tests/fixtures/simple-spec.yaml");
  const project = translateToIIM(spec);
  const toolsMap = generateTools(project);
  const defaultTools = toolsMap.get("default.ts");

  expect(defaultTools).toBeDefined();
  expect(defaultTools).toContain("handler: async (args: any, meta?: any)");
});


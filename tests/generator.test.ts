import { expect, test, beforeAll } from "bun:test";
import { parseOpenApiSpec } from "../src/parser/parser.ts";
import { translateToIIM } from "../src/parser/translator.ts";
import { generateZodSchemas } from "../src/generator/schema-generator.ts";
import { generateProjectBoilerplate } from "../src/generator/project-generator.ts";
import { MCPProject, MCP_PROTOCOL_VERSION } from "../src/models/types.ts";
import { rm } from "node:fs/promises";

beforeAll(async () => {
  try {
    await rm("tests/out", { recursive: true, force: true });
  } catch {}
});

test("generates valid zod schemas string", async () => {
  const spec = await parseOpenApiSpec("tests/fixtures/simple-spec.yaml");
  const project = translateToIIM(spec);
  const zodSchemaStr = generateZodSchemas(project);
  
  expect(zodSchemaStr).toContain('import { z } from "zod";');
  expect(zodSchemaStr).toContain("export const getUserInputSchema");
});

test("generates zod schemas for complex types, enums, tool names with numbers, and multiline descriptions", async () => {
  const project: MCPProject = {
    name: "complex-api",
    version: "1.0.0",
    protocolVersion: MCP_PROTOCOL_VERSION,
    outputDirectory: "./out",
    securitySchemes: [],
    tools: [
      {
        name: "get-item-1",
        description: "Get item 1 details",
        endpoint: {
          id: "get-item-1",
          operationId: "getItem1",
          method: "get",
          path: "/items/1",
          summary: "Get item 1",
          parameters: [],
          responses: []
        },
        inputSchema: {
          type: "object",
          properties: [
            {
              name: "status",
              type: "string",
              required: true,
              enum: ["active", "pending", "disabled"],
              description: 'Status filter with "quotes"\nand newlines'
            },
            {
              name: "tags",
              type: "array",
              required: false,
              items: {
                name: "",
                type: "string",
                required: true
              }
            },
            {
              name: "metadata",
              type: "object",
              required: false,
              properties: [
                {
                  name: "key",
                  type: "string",
                  required: true
                }
              ]
            },
            {
              name: "rawExtra",
              type: "object",
              required: false
            }
          ]
        }
      }
    ]
  };

  const zodSchemaStr = generateZodSchemas(project);

  // Assert valid identifier for tool with number
  expect(zodSchemaStr).toContain("export const getItem1InputSchema");

  // Assert enum generation
  expect(zodSchemaStr).toContain('z.enum(["active", "pending", "disabled"])');

  // Assert description properly escaped with JSON.stringify
  expect(zodSchemaStr).toContain('.describe("Status filter with \\"quotes\\"\\nand newlines")');

  // Assert array generation with items
  expect(zodSchemaStr).toContain("z.array(z.string())");

  // Assert nested object schema generation
  expect(zodSchemaStr).toContain("metadata: z.object({\n      key: z.string()");


  // Assert record generation for object without defined properties
  expect(zodSchemaStr).toContain("z.record(z.any())");
});

test("writes project boilerplate successfully", async () => {
  const spec = await parseOpenApiSpec("tests/fixtures/simple-spec.yaml");
  const project = translateToIIM(spec);
  await generateProjectBoilerplate(project, "tests/out");

  const filesToVerify = [
    "package.json",
    "tsconfig.json",
    "bunfig.toml",
    ".env.example",
    "README.md"
  ];

  for (const filename of filesToVerify) {
    const file = Bun.file(`tests/out/${filename}`);
    expect(await file.exists()).toBe(true);
  }

  const packageJsonFile = Bun.file("tests/out/package.json");
  const packageJson = await packageJsonFile.json();
  expect(packageJson.name).toBe("simple-test-api");
  expect(packageJson.dependencies["@modelcontextprotocol/sdk"]).toBeDefined();
  expect(packageJson.dependencies["zod-to-json-schema"]).toBeDefined();

  const envFile = Bun.file("tests/out/.env.example");
  const envText = await envFile.text();
  expect(envText).toContain("API_BASE_URL=http://localhost:8000");
});

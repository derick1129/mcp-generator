import { expect, test } from "bun:test";
import { parseOpenApiSpec } from "../src/parser/parser.ts";
import { translateToIIM } from "../src/parser/translator.ts";
import { generateTools } from "../src/generator/tool-generator.ts";
import { generateServerFile } from "../src/generator/server-generator.ts";

test("generates correct tools mapping", async () => {
  const spec = await parseOpenApiSpec("tests/fixtures/simple-spec.yaml");
  const project = translateToIIM(spec);
  const toolsMap = generateTools(project);

  expect(toolsMap.size).toBeGreaterThan(0);
  const defaultTools = toolsMap.get("default.ts");
  expect(defaultTools).toBeDefined();
  expect(defaultTools).toContain("export const getUserTool");
});

test("generates main server setup file", async () => {
  const spec = await parseOpenApiSpec("tests/fixtures/simple-spec.yaml");
  const project = translateToIIM(spec);
  const serverFileStr = generateServerFile(project);

  expect(serverFileStr).toContain("new Server");
  expect(serverFileStr).toContain("ListToolsRequestSchema");
});

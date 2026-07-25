import { expect, test, beforeAll } from "bun:test";
import { parseOpenApiSpec } from "../src/parser/parser.ts";
import { translateToIIM } from "../src/parser/translator.ts";
import { generateZodSchemas } from "../src/generator/schema-generator.ts";
import { generateProjectBoilerplate } from "../src/generator/project-generator.ts";
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
  
  expect(zodSchemaStr).toContain("import { z } from \"zod\";");
  expect(zodSchemaStr).toContain("export const getUserInputSchema");
});

test("writes project boilerplate successfully", async () => {
  const spec = await parseOpenApiSpec("tests/fixtures/simple-spec.yaml");
  const project = translateToIIM(spec);
  await generateProjectBoilerplate(project, "tests/out");

  const packageJsonFile = Bun.file("tests/out/package.json");
  expect(await packageJsonFile.exists()).toBe(true);
  const packageJson = await packageJsonFile.json();
  expect(packageJson.name).toBe("simple-test-api");
});

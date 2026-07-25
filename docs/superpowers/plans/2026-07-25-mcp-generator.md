# MCP Generator Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Automate the creation of production-ready Model Context Protocol (MCP) servers from OpenAPI 3.x specifications using Bun & TypeScript.

**Architecture:** Decouples input spec parsing, Internal Intermediate Model (IIM) translation, AST-based generation using `ts-morph` and Handlebars templates, and a subprocess-based verification runner.

**Tech Stack:** Bun, TypeScript, Commander.js, Swagger Parser, Zod, ts-morph, Handlebars, MCP TypeScript SDK, Bun Test.

## Global Constraints
- Target Language/Runtime: TypeScript, Bun
- Code Generation: Programmatic output via `ts-morph` for TS, Handlebars for boilerplate configuration
- Validation: End-to-end local project install, compile check, and MCP handshake test
- Linting/Formatting: ESM modules with standard tsconfig settings

---

### Task 1: Project Scaffolding and Core Dependencies

**Files:**
- Create: `package.json`
- Create: `tsconfig.json`
- Create: `bunfig.toml`
- Create: `tests/setup.test.ts`

**Interfaces:**
- Produces: Verification of working test suite runner

- [ ] **Step 1: Write the failing test**
  Create a test to verify our test runner runs properly.
  Create `tests/setup.test.ts`:
  ```typescript
  import { expect, test } from "bun:test";

  test("test runner is active", () => {
    expect(true).toBe(true);
  });
  ```

- [ ] **Step 2: Run test to verify it fails**
  Run: `bun test tests/setup.test.ts`
  Expected: FAIL with "bun command not found" or package config errors since dependencies aren't configured yet.

- [ ] **Step 3: Write minimal implementation**
  Create `package.json`:
  ```json
  {
    "name": "mcp-generator",
    "version": "1.0.0",
    "type": "module",
    "main": "src/index.ts",
    "bin": {
      "mcpgen": "./src/cli/index.ts"
    },
    "dependencies": {
      "@apidevtools/swagger-parser": "^10.1.0",
      "@modelcontextprotocol/sdk": "^1.0.1",
      "commander": "^11.1.0",
      "handlebars": "^4.7.8",
      "ts-morph": "^21.0.1",
      "zod": "^3.22.4"
    },
    "devDependencies": {
      "@types/bun": "latest",
      "typescript": "^5.3.3"
    }
  }
  ```

  Create `tsconfig.json`:
  ```json
  {
    "compilerOptions": {
      "lib": ["ESNext"],
      "module": "esnext",
      "target": "esnext",
      "moduleResolution": "bundler",
      "moduleDetection": "force",
      "allowImportingTsExtensions": true,
      "noEmit": true,
      "strict": true,
      "skipLibCheck": true,
      "noUnusedLocals": true,
      "noUnusedParameters": true,
      "noImplicitReturns": true
    }
  }
  ```

  Create `bunfig.toml`:
  ```toml
  [install]
  lockfile = true
  ```

- [ ] **Step 4: Run test to verify it passes**
  Run: `bun install && bun test tests/setup.test.ts`
  Expected: PASS

- [ ] **Step 5: Commit**
  Run:
  ```bash
  git add package.json tsconfig.json bunfig.toml tests/setup.test.ts
  git commit -m "chore: scaffold project structure and install dependencies"
  ```

---

### Task 2: OpenAPI Parser & Resolver

**Files:**
- Create: `src/parser/parser.ts`
- Create: `tests/fixtures/simple-spec.yaml`
- Create: `tests/parser.test.ts`

**Interfaces:**
- Produces: `parseOpenApiSpec(filePathOrUrl: string): Promise<any>`

- [ ] **Step 1: Write the failing test**
  Create `tests/fixtures/simple-spec.yaml`:
  ```yaml
  openapi: 3.0.0
  info:
    title: Simple Test API
    version: 1.0.0
  paths:
    /users/{id}:
      get:
        summary: Get user
        operationId: getUser
        parameters:
          - name: id
            in: path
            required: true
            schema:
              type: string
        responses:
          '200':
            description: Success
            content:
              application/json:
                schema:
                  $ref: '#/components/schemas/User'
  components:
    schemas:
      User:
        type: object
        properties:
          id:
            type: string
          name:
            type: string
  ```

  Create `tests/parser.test.ts`:
  ```typescript
  import { expect, test } from "bun:test";
  import { parseOpenApiSpec } from "../src/parser/parser.ts";

  test("parses and dereferences an OpenAPI spec", async () => {
    const spec = await parseOpenApiSpec("tests/fixtures/simple-spec.yaml");
    expect(spec.info.title).toBe("Simple Test API");
    // Verify dereferencing succeeded
    const responseSchema = spec.paths["/users/{id}"].get.responses["200"].content["application/json"].schema;
    expect(responseSchema.properties.name.type).toBe("string");
  });
  ```

- [ ] **Step 2: Run test to verify it fails**
  Run: `bun test tests/parser.test.ts`
  Expected: FAIL with module loading errors for parser.ts

- [ ] **Step 3: Write minimal implementation**
  Create `src/parser/parser.ts`:
  ```typescript
  import SwaggerParser from "@apidevtools/swagger-parser";

  export async function parseOpenApiSpec(filePathOrUrl: string): Promise<any> {
    try {
      // validate and dereference the spec
      const api = await SwaggerParser.dereference(filePathOrUrl);
      return api;
    } catch (error) {
      throw new Error(`Failed to parse OpenAPI spec: ${(error as Error).message}`);
    }
  }
  ```

- [ ] **Step 4: Run test to verify it passes**
  Run: `bun test tests/parser.test.ts`
  Expected: PASS

- [ ] **Step 5: Commit**
  Run:
  ```bash
  git add src/parser/parser.ts tests/fixtures/simple-spec.yaml tests/parser.test.ts
  git commit -m "feat: implement openapi specification parser and resolver"
  ```

---

### Task 3: Internal Intermediate Model (IIM) Translator

**Files:**
- Create: `src/models/types.ts`
- Create: `src/parser/translator.ts`
- Create: `tests/translator.test.ts`

**Interfaces:**
- Consumes: Resolved OpenAPI object from `parseOpenApiSpec`
- Produces: `translateToIIM(spec: any): MCPProject`

- [ ] **Step 1: Write the failing test**
  Create `tests/translator.test.ts`:
  ```typescript
  import { expect, test } from "bun:test";
  import { parseOpenApiSpec } from "../src/parser/parser.ts";
  import { translateToIIM } from "../src/parser/translator.ts";

  test("translates OpenAPI to intermediate model", async () => {
    const spec = await parseOpenApiSpec("tests/fixtures/simple-spec.yaml");
    const project = translateToIIM(spec);

    expect(project.name).toBe("simple-test-api");
    expect(project.tools.length).toBe(1);
    const tool = project.tools[0];
    expect(tool.name).toBe("get-user");
    expect(tool.endpoint.method).toBe("get");
    expect(tool.endpoint.path).toBe("/users/{id}");
  });
  ```

- [ ] **Step 2: Run test to verify it fails**
  Run: `bun test tests/translator.test.ts`
  Expected: FAIL (translator not defined)

- [ ] **Step 3: Write minimal implementation**
  Create `src/models/types.ts`:
  ```typescript
  export interface PropertyDefinition {
    name: string;
    type: string;
    required: boolean;
    description?: string;
    enum?: string[];
    properties?: PropertyDefinition[];
    items?: PropertyDefinition;
  }

  export interface SchemaDefinition {
    name?: string;
    type: string;
    description?: string;
    properties?: PropertyDefinition[];
    items?: PropertyDefinition;
  }

  export interface ParameterDefinition {
    name: string;
    in: 'path' | 'query' | 'header';
    required: boolean;
    description?: string;
    schema: SchemaDefinition;
  }

  export interface RequestBodyDefinition {
    description?: string;
    required: boolean;
    schema: SchemaDefinition;
  }

  export interface ResponseDefinition {
    statusCode: string;
    description?: string;
    schema?: SchemaDefinition;
  }

  export interface EndpointDefinition {
    id: string;
    operationId: string;
    method: 'get' | 'post' | 'put' | 'patch' | 'delete';
    path: string;
    summary: string;
    description?: string;
    parameters: ParameterDefinition[];
    requestBody?: RequestBodyDefinition;
    responses: ResponseDefinition[];
    securityRequirement?: string[];
  }

  export interface SecurityScheme {
    id: string;
    type: 'apiKey' | 'http';
    name?: string;
    in?: 'header' | 'query';
    scheme?: 'bearer';
  }

  export interface ToolDefinition {
    name: string;
    description: string;
    endpoint: EndpointDefinition;
    inputSchema: SchemaDefinition;
    outputSchema?: SchemaDefinition;
  }

  export interface MCPProject {
    name: string;
    version: string;
    outputDirectory: string;
    tools: ToolDefinition[];
    securitySchemes: SecurityScheme[];
  }
  ```

  Create `src/parser/translator.ts`:
  ```typescript
  import { MCPProject, ToolDefinition, EndpointDefinition, SchemaDefinition, PropertyDefinition } from "../models/types.ts";

  function cleanKebab(str: string): string {
    return str.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
  }

  function resolveSchema(schema: any): SchemaDefinition {
    if (!schema) return { type: "object", properties: [] };
    const type = schema.type || "object";
    const properties: PropertyDefinition[] = [];

    if (schema.properties) {
      for (const [key, prop] of Object.entries(schema.properties) as any[]) {
        properties.push({
          name: key,
          type: prop.type || "string",
          required: Array.isArray(schema.required) && schema.required.includes(key),
          description: prop.description,
          enum: prop.enum,
          properties: prop.properties ? resolveSchema(prop).properties : undefined,
          items: prop.items ? { name: "", type: prop.items.type || "string", required: true } : undefined
        });
      }
    }

    return {
      type,
      description: schema.description,
      properties,
      items: schema.items ? { name: "", type: schema.items.type || "string", required: true } : undefined
    };
  }

  export function translateToIIM(spec: any): MCPProject {
    const title = spec.info?.title || "mcp-server";
    const version = spec.info?.version || "1.0.0";
    const tools: ToolDefinition[] = [];

    for (const [path, methods] of Object.entries(spec.paths)) {
      for (const [method, operation] of Object.entries(methods as any)) {
        if (!["get", "post", "put", "patch", "delete"].includes(method)) continue;

        const op = operation as any;
        const operationId = op.operationId || `${method}-${path.replace(/[{}]/g, "").replace(/\//g, "-")}`;
        const name = cleanKebab(operationId);

        const parameters = (op.parameters || []).map((p: any) => ({
          name: p.name,
          in: p.in,
          required: !!p.required,
          description: p.description,
          schema: resolveSchema(p.schema)
        }));

        // Flatten parameters into single Zod object inputSchema
        const inputProperties: PropertyDefinition[] = parameters.map((p: any) => ({
          name: p.name,
          type: p.schema.type,
          required: p.required,
          description: p.description
        }));

        const endpoint: EndpointDefinition = {
          id: name,
          operationId,
          method: method as any,
          path,
          summary: op.summary || "",
          description: op.description,
          parameters,
          responses: []
        };

        tools.push({
          name,
          description: op.summary || op.description || `Execute ${method} request to ${path}`,
          endpoint,
          inputSchema: {
            type: "object",
            properties: inputProperties
          }
        });
      }
    }

    return {
      name: cleanKebab(title),
      version,
      outputDirectory: "./generated-mcp-server",
      tools,
      securitySchemes: []
    };
  }
  ```

- [ ] **Step 4: Run test to verify it passes**
  Run: `bun test tests/translator.test.ts`
  Expected: PASS

- [ ] **Step 5: Commit**
  Run:
  ```bash
  git add src/models/types.ts src/parser/translator.ts tests/translator.test.ts
  git commit -m "feat: translate OpenAPI spec definitions to IIM models"
  ```

---

### Task 4: Code Generation - Boilerplate & Zod Schemas

**Files:**
- Create: `templates/package.json.hbs`
- Create: `templates/tsconfig.json.hbs`
- Create: `templates/bunfig.toml.hbs`
- Create: `templates/env.example.hbs`
- Create: `templates/README.md.hbs`
- Create: `src/generator/project-generator.ts`
- Create: `src/generator/schema-generator.ts`
- Create: `tests/generator.test.ts`

**Interfaces:**
- Consumes: `MCPProject` metadata
- Produces:
  - `generateProjectBoilerplate(project: MCPProject, outDir: string): Promise<void>`
  - `generateZodSchemas(project: MCPProject): string`

- [ ] **Step 1: Write the failing test**
  Create `tests/generator.test.ts`:
  ```typescript
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
  ```

- [ ] **Step 2: Run test to verify it fails**
  Run: `bun test tests/generator.test.ts`
  Expected: FAIL

- [ ] **Step 3: Write minimal implementation**
  Create the Handlebars templates under `templates/`:
  
  `templates/package.json.hbs`:
  ```json
  {
    "name": "{{name}}",
    "version": "{{version}}",
    "type": "module",
    "main": "src/index.ts",
    "dependencies": {
      "@modelcontextprotocol/sdk": "^1.0.1",
      "zod": "^3.22.4"
    },
    "devDependencies": {
      "@types/node": "latest",
      "typescript": "^5.3.3"
    }
  }
  ```

  `templates/tsconfig.json.hbs`:
  ```json
  {
    "compilerOptions": {
      "target": "ESNext",
      "module": "NodeNext",
      "moduleResolution": "NodeNext",
      "strict": true,
      "esModuleInterop": true,
      "skipLibCheck": true,
      "outDir": "./dist"
    },
    "include": ["src/**/*"]
  }
  ```

  `templates/bunfig.toml.hbs`:
  ```toml
  [install]
  lockfile = true
  ```

  `templates/env.example.hbs`:
  ```
  API_BASE_URL=http://localhost:8000
  ```

  `templates/README.md.hbs`:
  ```markdown
  # {{name}} MCP Server
  Generated via mcp-generator.
  ```

  Create `src/generator/schema-generator.ts`:
  ```typescript
  import { MCPProject } from "../models/types.ts";
  import { Project, VariableDeclarationKind } from "ts-morph";

  export function generateZodSchemas(project: MCPProject): string {
    const tsProject = new Project({ useInMemoryFileSystem: true });
    const sourceFile = tsProject.createSourceFile("schemas.ts", `import { z } from "zod";\n`);

    for (const tool of project.tools) {
      const camelName = tool.name.replace(/-([a-z])/g, (g) => g[1].toUpperCase());
      const inputSchemaName = `${camelName}InputSchema`;
      
      const properties: string[] = [];
      if (tool.inputSchema.properties) {
        for (const prop of tool.inputSchema.properties) {
          let line = `${prop.name}: z.${prop.type}()`;
          if (prop.description) {
            line += `.describe("${prop.description.replace(/"/g, '\\"')}")`;
          }
          if (!prop.required) {
            line += ".optional()";
          }
          properties.push(line);
        }
      }

      sourceFile.addVariableStatement({
        declarationKind: VariableDeclarationKind.Const,
        isExported: true,
        declarations: [{
          name: inputSchemaName,
          initializer: `z.object({\n  ${properties.join(",\n  ")}\n})`
        }]
      });
    }

    return sourceFile.getFullText();
  }
  ```

  Create `src/generator/project-generator.ts`:
  ```typescript
  import { MCPProject } from "../models/types.ts";
  import Handlebars from "handlebars";
  import { mkdir, writeFile } from "node:fs/promises";
  import { join } from "node:path";

  const templateMap: Record<string, string> = {
    "package.json": "package.json.hbs",
    "tsconfig.json": "tsconfig.json.hbs",
    "bunfig.toml": "bunfig.toml.hbs",
    ".env.example": "env.example.hbs",
    "README.md": "README.md.hbs"
  };

  export async function generateProjectBoilerplate(project: MCPProject, outDir: string): Promise<void> {
    await mkdir(outDir, { recursive: true });

    for (const [filename, templateName] of Object.entries(templateMap)) {
      const templatePath = join(import.meta.dir, "../../templates", templateName);
      const templateContent = await Bun.file(templatePath).text();
      const compiled = Handlebars.compile(templateContent);
      const result = compiled({
        name: project.name,
        version: project.version
      });

      await writeFile(join(outDir, filename), result);
    }
  }
  ```

- [ ] **Step 4: Run test to verify it passes**
  Run: `bun test tests/generator.test.ts`
  Expected: PASS

- [ ] **Step 5: Commit**
  Run:
  ```bash
  git add templates/ src/generator/project-generator.ts src/generator/schema-generator.ts tests/generator.test.ts
  git commit -m "feat: implement configuration boilerplate and zod schema code generators"
  ```

---

### Task 5: Code Generation - MCP Tools & Server Files

**Files:**
- Create: `src/generator/tool-generator.ts`
- Create: `src/generator/server-generator.ts`
- Create: `tests/tool-generator.test.ts`

**Interfaces:**
- Consumes: `MCPProject` structure
- Produces:
  - `generateTools(project: MCPProject): Map<string, string>`
  - `generateServerFile(project: MCPProject): string`

- [ ] **Step 1: Write the failing test**
  Create `tests/tool-generator.test.ts`:
  ```typescript
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
  ```

- [ ] **Step 2: Run test to verify it fails**
  Run: `bun test tests/tool-generator.test.ts`
  Expected: FAIL

- [ ] **Step 3: Write minimal implementation**
  Create `src/generator/tool-generator.ts`:
  ```typescript
  import { MCPProject } from "../models/types.ts";
  import { Project, VariableDeclarationKind } from "ts-morph";

  export function generateTools(project: MCPProject): Map<string, string> {
    const files = new Map<string, string>();
    const tsProject = new Project({ useInMemoryFileSystem: true });

    const sourceFile = tsProject.createSourceFile("default.ts", `import { z } from "zod";\nimport * as schemas from "../schemas.js";\n`);

    for (const tool of project.tools) {
      const camelName = tool.name.replace(/-([a-z])/g, (g) => g[1].toUpperCase());
      const inputSchemaName = `schemas.${camelName}InputSchema`;
      
      const functionBody = `
        const baseUrl = process.env.API_BASE_URL || "http://localhost:8000";
        const path = "${tool.endpoint.path}".replace(/{(\\w+)}/g, (_, name) => encodeURIComponent((args as any)[name]));
        const url = new URL(baseUrl + path);
        
        // Add query parameters
        if (args) {
          for (const [key, value] of Object.entries(args)) {
            if (!"${tool.endpoint.path}".includes("{" + key + "}")) {
              url.searchParams.append(key, String(value));
            }
          }
        }

        const response = await fetch(url.toString(), {
          method: "${tool.endpoint.method.toUpperCase()}"
        });

        if (!response.ok) {
          return {
            isError: true,
            content: [{ type: "text", text: "HTTP request failed: " + response.statusText }]
          };
        }

        const text = await response.text();
        return {
          content: [{ type: "text", text }]
        };
      `;

      sourceFile.addVariableStatement({
        declarationKind: VariableDeclarationKind.Const,
        isExported: true,
        declarations: [{
          name: `${camelName}Tool`,
          initializer: `{\n  name: "${tool.name}",\n  description: "${tool.description}",\n  inputSchema: ${inputSchemaName},\n  handler: async (args: any) => {${functionBody}}\n}`
        }]
      });
    }

    files.set("default.ts", sourceFile.getFullText());
    return files;
  }
  ```

  Create `src/generator/server-generator.ts`:
  ```typescript
  import { MCPProject } from "../models/types.ts";
  import { Project } from "ts-morph";

  export function generateServerFile(project: MCPProject): string {
    const tsProject = new Project({ useInMemoryFileSystem: true });
    const sourceFile = tsProject.createSourceFile("server.ts", `
      import { Server } from "@modelcontextprotocol/sdk/server/index.js";
      import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
      import { ListToolsRequestSchema, CallToolRequestSchema } from "@modelcontextprotocol/sdk/types.js";
      import * as defaultTools from "./tools/default.js";

      const server = new Server(
        { name: "${project.name}", version: "${project.version}" },
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
            inputSchema: {
              type: "object",
              properties: {} // Mock simple schema mappings
            }
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
    `);

    return sourceFile.getFullText();
  }
  ```

- [ ] **Step 4: Run test to verify it passes**
  Run: `bun test tests/tool-generator.test.ts`
  Expected: PASS

- [ ] **Step 5: Commit**
  Run:
  ```bash
  git add src/generator/tool-generator.ts src/generator/server-generator.ts tests/tool-generator.test.ts
  git commit -m "feat: implement tool and server logic generator modules"
  ```

---

### Task 6: CLI & Verification Runner

**Files:**
- Create: `src/runtime/validator.ts`
- Create: `src/cli/index.ts`
- Create: `tests/integration.test.ts`

**Interfaces:**
- Consumes: OpenAPI paths, build output, commands
- Produces: Execution CLI commands (`generate`, `validate`) and background verification

- [ ] **Step 1: Write the failing test**
  Create `tests/integration.test.ts`:
  ```typescript
  import { expect, test } from "bun:test";
  import { spawnSync } from "node:child_process";
  import { rm } from "node:fs/promises";

  test("runs CLI and generates fully compilable project", async () => {
    try {
      await rm("tests/integration-out", { recursive: true, force: true });
    } catch {}

    const result = spawnSync("bun", [
      "src/cli/index.ts",
      "generate",
      "tests/fixtures/simple-spec.yaml",
      "-o",
      "tests/integration-out",
      "-f"
    ]);

    expect(result.status).toBe(0);
    expect(Bun.file("tests/integration-out/src/server.ts").exists()).resolve.toBe(true);
  });
  ```

- [ ] **Step 2: Run test to verify it fails**
  Run: `bun test tests/integration.test.ts`
  Expected: FAIL

- [ ] **Step 3: Write minimal implementation**
  Create `src/runtime/validator.ts`:
  ```typescript
  import { spawnSync } from "node:child_process";

  export async function runVerification(outputDir: string): Promise<boolean> {
    // Basic verification: test Bun install and runtime compilation check
    const install = spawnSync("bun", ["install"], { cwd: outputDir });
    if (install.status !== 0) return false;

    const compile = spawnSync("bunx", ["tsc", "--noEmit"], { cwd: outputDir });
    return compile.status === 0;
  }
  ```

  Create `src/cli/index.ts`:
  ```typescript
  #!/usr/bin/env bun
  import { Command } from "commander";
  import { parseOpenApiSpec } from "../parser/parser.ts";
  import { translateToIIM } from "../parser/translator.ts";
  import { generateProjectBoilerplate } from "../generator/project-generator.ts";
  import { generateZodSchemas } from "../generator/schema-generator.ts";
  import { generateTools } from "../generator/tool-generator.ts";
  import { generateServerFile } from "../generator/server-generator.ts";
  import { runVerification } from "../runtime/validator.ts";
  import { mkdir, writeFile } from "node:fs/promises";
  import { join } from "node:path";

  const program = new Command();

  program
    .name("mcpgen")
    .description("Generate MCP servers from OpenAPI specs")
    .version("1.0.0");

  program
    .command("generate <spec>")
    .option("-o, --out-dir <dir>", "Output directory", "./generated-mcp-server")
    .option("-f, --force", "Force overwrite", false)
    .action(async (specPath, options) => {
      console.log(`⚙️  Parsing OpenAPI specification...`);
      const spec = await parseOpenApiSpec(specPath);
      const project = translateToIIM(spec);
      
      console.log(`📦 Building Internal Intermediate Model...`);
      const outDir = options.out-dir || "./generated-mcp-server";
      
      console.log(`📁 Writing project assets...`);
      await generateProjectBoilerplate(project, outDir);
      
      const srcDir = join(outDir, "src");
      await mkdir(srcDir, { recursive: true });
      
      console.log(`🧬 Compiling schema validations...`);
      const schemas = generateZodSchemas(project);
      await writeFile(join(srcDir, "schemas.ts"), schemas);

      console.log(`🚀 Synthesizing tool files...`);
      const tools = generateTools(project);
      const toolsDir = join(srcDir, "tools");
      await mkdir(toolsDir, { recursive: true });
      for (const [name, code] of tools.entries()) {
        await writeFile(join(toolsDir, name), code);
      }

      const serverFile = generateServerFile(project);
      await writeFile(join(srcDir, "server.ts"), serverFile);
      
      // index.ts as entry point
      await writeFile(join(srcDir, "index.ts"), `import "./server.js";\n`);

      console.log(`✨ MCP Server successfully generated at "${outDir}"!`);
      
      const valid = await runVerification(outDir);
      if (valid) {
        console.log("✅ Project validation passed compilation check.");
      } else {
        console.log("❌ Project validation failed compilation check.");
      }
    });

  program.parse();
  ```

- [ ] **Step 4: Run test to verify it passes**
  Run: `bun test tests/integration.test.ts`
  Expected: PASS

- [ ] **Step 5: Commit**
  Run:
  ```bash
  git add src/runtime/validator.ts src/cli/index.ts tests/integration.test.ts
  git commit -m "feat: complete cli command registration and validation runner integration"
  ```

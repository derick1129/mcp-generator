# MCP Generator — System Design Specification

## Overview

MCP Generator (`mcpgen`) is a CLI tool built with **Bun** and **TypeScript** designed to automate the creation of **Model Context Protocol (MCP)** servers from existing **OpenAPI 3.x Specifications**.

By parsing an OpenAPI specification (YAML/JSON), resolving ref pointers, building an intermediate representation, generating code using `ts-morph` and Handlebars templates, and validating the resulting project, `mcpgen` produces a deterministic, tested, and runnable MCP server with zero manual intervention.

---

## System Architecture

The generator follows a compiler-style pipeline:

```
        OpenAPI Spec (JSON / YAML)
                     │
                     ▼
        OpenAPI Parser & Validator
        (@apidevtools/swagger-parser)
                     │
                     ▼
      Internal Intermediate Model (IIM)
                     │
                     ▼
           Code Generation Engine
      (ts-morph AST & Handlebars templates)
                     │
                     ▼
      Generated TypeScript MCP Project
                     │
                     ▼
          Verification Pipeline
       (bun install -> compile -> handshake)
                     │
                     ▼
            Runnable MCP Server
```

---

## Package & File Structure

```
mcp-generator/
├── bunfig.toml
├── package.json
├── tsconfig.json
├── README.md
├── docs/
│   └── superpowers/
│       └── specs/
│           └── 2026-07-25-mcp-generator-design.md (This spec)
├── src/
│   ├── index.ts                 # Main exports
│   ├── cli/                     # CLI commands (Commander.js)
│   │   ├── index.ts             # CLI command configuration
│   │   ├── generate.ts          # generate command
│   │   ├── validate.ts          # validate command
│   │   ├── doctor.ts            # doctor environment checker
│   │   └── init.ts              # initializer for configuration
│   ├── parser/                  # Parsing and Dereferencing
│   │   ├── parser.ts            # Swagger parser entry
│   │   └── resolver.ts          # OpenAPI normalization
│   ├── models/                  # Intermediate Data Models
│   │   ├── endpoint.ts
│   │   ├── tool.ts
│   │   ├── auth.ts
│   │   ├── schema.ts
│   │   └── project.ts
│   ├── generator/               # Code-Gen Engine
│   │   ├── engine.ts            # Orchestrates ts-morph & templates
│   │   ├── project-generator.ts # Generates project config (package.json, etc.)
│   │   ├── tool-generator.ts    # Code-gen for MCP tool wrappers
│   │   └── schema-generator.ts  # Code-gen for Zod schemas
│   └── runtime/                 # Subprocesses for Validation
│       ├── installer.ts         # bun install execution
│       └── validator.ts         # Compilation check & MCP handshake
├── templates/                   # Handlebars source templates
│   ├── package.json.hbs
│   ├── tsconfig.json.hbs
│   ├── bunfig.toml.hbs
│   ├── env.example.hbs
│   └── README.md.hbs
└── tests/                       # Unit and Integration tests
    ├── parser.test.ts
    ├── generator.test.ts
    ├── validator.test.ts
    └── fixtures/
        └── petstore.yaml
```

---

## Internal Intermediate Model (IIM)

The IIM defines the standard schema that separates spec parsing from template generation.

```typescript
export interface PropertyDefinition {
  name: string;
  type: string;        // 'string' | 'number' | 'integer' | 'boolean' | 'array' | 'object'
  required: boolean;
  description?: string;
  enum?: string[];
  properties?: PropertyDefinition[]; // For object types
  items?: PropertyDefinition;        // For array types
}

export interface SchemaDefinition {
  name?: string;                     // Named models from component schemas
  type: string;                      // 'string', 'number', 'object', etc.
  description?: string;
  properties?: PropertyDefinition[];
  items?: PropertyDefinition;        // For array elements
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
  name?: string;            // e.g., 'X-API-Key'
  in?: 'header' | 'query';
  scheme?: 'bearer';
}

export interface ToolDefinition {
  name: string;             // Safe MCP tool name (lowercase alphanumeric, dashes/underscores)
  description: string;
  endpoint: EndpointDefinition;
  inputSchema: SchemaDefinition;  // Flattened params & requestBody fields
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

---

## Code Generation Strategy

The generation engine outputs a clean, modular structure.

### 1. Template Outputs (Handlebars)
* `tsconfig.json`: Converted target output options for Bun environment.
* `bunfig.toml`: Local project bun configurations.
* `.env.example`: Generates needed variables like `API_BASE_URL` and `API_KEY` or `BEARER_TOKEN` based on security requirements.
* `README.md`: Step-by-step instructions on setting up and running the server.

### 2. Output Schema Generation (`src/schemas.ts`)
Using `ts-morph`, named OpenAPI components and models are generated into Zod validators:
```typescript
import { z } from "zod";

export const UserSchema = z.object({
  id: z.string(),
  name: z.string(),
  email: z.string().email().optional(),
});
```

### 3. Tool File Modular Generation (`src/tools/<tag>.ts`)
Tools are split into modules based on their tags (falling back to a `default` tag).
Each tool file exports a list of tools matching a registry contract:
```typescript
import { z } from "zod";
import * as schemas from "../schemas.js";
import { getAuthHeaders } from "../auth.js";

export const getProductTool = {
  name: "get-product",
  description: "Retrieve product details",
  inputSchema: z.object({
    id: z.string().describe("The product ID"),
  }),
  handler: async (args: { id: string }) => {
    const baseUrl = process.env.API_BASE_URL || "https://api.example.com";
    const url = new URL(`${baseUrl}/products/${encodeURIComponent(args.id)}`);
    const headers = new Headers({
      "Accept": "application/json",
      ...getAuthHeaders(),
    });

    const response = await fetch(url.toString(), {
      method: "GET",
      headers,
    });

    if (!response.ok) {
      const errorText = await response.text();
      return {
        isError: true,
        content: [{ type: "text", text: `API failed (${response.status}): ${errorText}` }],
      };
    }

    const data = await response.json();
    return {
      content: [{ type: "text", text: JSON.stringify(data, null, 2) }],
    };
  },
};
```

---

## CLI Command Specifications

The CLI commands map as follows:
* **`mcpgen init`**: Initializes directory, default layouts, and configuration properties.
* **`mcpgen generate <spec>`**:
  * Options:
    * `-o, --out-dir <path>`: Output folder (default: `./generated-mcp-server`).
    * `-f, --force`: Skip interactive overwrite confirmation prompt.
    * `--no-install`: Skip executing `bun install` after generation.
    * `--validate`: Triggers verification suite immediately following generation.
* **`mcpgen validate [path]`**: Runs standard checking, installs, builds, type-checks, starts process, and runs test JSON-RPC calls.
* **`mcpgen doctor`**: Ensures current user environment meets required tools (Bun, networks).

---

## Verification & Handshake Process

To ensure validity, `mcpgen validate` performs:
1. Spawns child process: `bun src/index.ts`.
2. Sends JSON-RPC `initialize` message to stdin.
3. Assures protocol handshake confirmation response exists in stdout.
4. Executes JSON-RPC `tools/list` request, verifying tools generated align with parsed API endpoint operations.
5. Sends shutdown signals and kills the spawned process.

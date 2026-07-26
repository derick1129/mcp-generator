# MCP Generator (`mcpgen`)

MCP Generator is a **Bun + TypeScript** CLI application designed to compile existing **OpenAPI 3.x Specifications** (JSON or YAML) into production-ready, fully-validated **Model Context Protocol (MCP)** servers.

Instead of manually implementing standard CRUD endpoint wrappers for every REST API, `mcpgen` parses the specification, resolves all schema refs, programmatically structures TypeScript code using `ts-morph` AST and Handlebars templates, type-checks the generated code, and validates standard stdio JSON-RPC initialization handshakes.

---

## Architecture Pipeline

The compiler follows a simple 3-layer architecture. An OpenAPI spec enters through the CLI, gets normalized into an internal project model, and is then emitted as a runnable MCP server.

```
+------------------------------------------+
|      OpenAPI Specification (JSON/YAML)   |
+------------------------------------------+
                     |
                     |  [1] Input Layer
                     v
+------------------------------------------+
|       CLI + OpenAPI Parser/Resolver      |
|  cli/index.ts + parser/parser.ts         |
+------------------------------------------+
                     |
                     |  [2] Translation Layer
                     v
+------------------------------------------+
|      Internal Intermediate Model (IIM)   |
| parser/translator.ts + models/types.ts   |
+------------------------------------------+
                     |
                     |  [3] Output Layer
                     v
+------------------------------------------+
|       Generated TypeScript MCP Server    |
| generator/* + runtime/validator.ts       |
+------------------------------------------+
                     |
                     |  Validation
                     v
+------------------------------------------+
|             Runnable Server              |
|   (Checked via bun install & handshake)  |
+------------------------------------------+
```

### What Each Layer Does:
1. **Input layer**: `cli/index.ts` defines the `mcpgen generate <spec>` and `mcpgen validate [dir]` commands. `parser/parser.ts` uses Swagger Parser to dereference the OpenAPI document and return a resolved spec object.
2. **Translation layer**: `parser/translator.ts` converts the resolved OpenAPI paths, methods, parameters, request bodies, responses, and security schemes into the Internal Intermediate Model (IIM). `models/types.ts` defines the TypeScript interfaces for that model.
3. **Output layer**: The files in `generator/` turn the IIM into a generated MCP server. `project-generator.ts` writes template-based project files, `schema-generator.ts` writes Zod schemas, `tool-generator.ts` writes fetch-based MCP tool handlers into `tools/default.ts`, and `server-generator.ts` writes the MCP stdio server. `runtime/validator.ts` installs dependencies, type-checks the generated project, and performs a JSON-RPC initialization handshake.

---

## Folder Structure

```
mcp-generator/
├── bunfig.toml                 # Bun runtime settings
├── package.json                # Project dependencies & binary mapping
├── tsconfig.json               # Global compiler configuration
├── README.md                   # This overview file
├── templates/                  # Boilerplate templates for generated servers
│   ├── package.json.hbs
│   ├── tsconfig.json.hbs
│   ├── bunfig.toml.hbs
│   ├── env.example.hbs
│   └── README.md.hbs
├── src/                        # Main compiler source files
│   ├── cli/                    # CLI execution routing (Commander.js)
│   │   ├── index.ts            # Commander setup and callbacks
│   ├── parser/                 # Resolver and intermediate translator
│   │   ├── parser.ts           # Spec resolving logic
│   │   └── translator.ts       # Maps resolved spec to intermediate models
│   ├── models/                 # IIM TypeScript interface declarations
│   │   └── types.ts
│   ├── generator/              # Code synthesis engines
│   │   ├── project-generator.ts # Writes configuration files
│   │   ├── schema-generator.ts  # Programmatically writes Zod schemas
│   │   ├── server-generator.ts  # Synthesizes main server listener
│   │   └── tool-generator.ts    # Emits tools/default.ts fetch wrappers
│   └── runtime/                # Under-the-hood validations
│       └── validator.ts        # Compiles, type-checks, and handshakes
└── tests/                      # Core test suite (using bun test)
    ├── fixtures/               # Input specs used in testing
    ├── generator.test.ts       # Boilerplate and Zod output tests
    ├── integration.test.ts     # CLI validation tests
    ├── parser.test.ts          # OpenAPI parser unit tests
    ├── tool-generator.test.ts  # Generated tool compilation tests
    └── translator.test.ts      # IIM normalization tests
```

---

## Usage

### 1. Installation
Install the generator globally or run it via Bun:
```bash
bun link
```

### 2. Generate a server
```bash
mcpgen generate <openapi.json_or_yaml_path_or_url> -o ./my-mcp-server
```
Options:
* `-o, --out-dir <dir>`: Target generation folder (defaults to `./generated-mcp-server`)
* `-f, --force`: Silently overwrite the target directory if it already exists

### 3. Validate a server
```bash
mcpgen validate ./my-mcp-server
```
Compiles the project, type-checks the generated TypeScript code, and performs a live JSON-RPC handshake verification.

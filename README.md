# MCP Generator (`mcpgen`)

MCP Generator is a **Bun + TypeScript** CLI application designed to compile existing **OpenAPI 3.x Specifications** (JSON or YAML) into production-ready, fully-validated **Model Context Protocol (MCP)** servers.

Instead of manually implementing standard CRUD endpoint wrappers for every REST API, `mcpgen` parses the specification, resolves all schema refs, programmatically structures TypeScript code using `ts-morph` AST and Handlebars templates, type-checks the generated code, and validates standard stdio JSON-RPC initialization handshakes.

---

## Architecture Pipeline

The compiler follows a distinct 5-stage architecture pipeline to decouple the source input parsing from final output styling:

```
+------------------------------------------+
|      OpenAPI Specification (JSON/YAML)   |
+------------------------------------------+
                     |
                     |  [1] Parsing & Dereferencing
                     v
+------------------------------------------+
|         OpenAPI Parser & Resolver        |
|       (@apidevtools/swagger-parser)      |
+------------------------------------------+
                     |
                     |  [2] Translation & Normalization
                     v
+------------------------------------------+
|      Internal Intermediate Model (IIM)   |
|   (Types defining endpoints, schemas,    |
|      servers, and security rules)        |
+------------------------------------------+
                     |
                     |  [3] Code Generation
                     v
+------------------------------------------+
|          Code Generation Engine          |
|      (ts-morph AST + Handlebars templates) |
+------------------------------------------+
                     |
                     |  [4] Scaffolding
                     v
+------------------------------------------+
|    Generated TypeScript MCP Server       |
|     (Zod Schemas + fetch handlers)       |
+------------------------------------------+
                     |
                     |  [5] Subprocess verification
                     v
+------------------------------------------+
|             Runnable Server              |
|   (Checked via bun install & handshake)  |
+------------------------------------------+
```

### What Each Layer Does:
1. **OpenAPI Parser**: Parses raw JSON or YAML. Uses Swagger Parser to resolve all circular and external `$ref` schema references, transforming the file into a unified, flattened OpenAPI document.
2. **Intermediate Translator**: Translates the OpenAPI schema definitions into our Internal Intermediate Model (IIM). This layer normalizes method paths, separates URL parameters (query/path/headers) from JSON bodies, filters security credentials (`apiKey`/`http`), and formats API names to safe kebab-case MCP tools.
3. **Zod & Code Generator**: Emits TypeScript code using programmatic AST manipulation via `ts-morph` to guarantee syntactically valid files. It generates schemas (`schemas.ts`), tools grouped by OpenAPI tags (`tools/`), and the entrypoint server registering the schemas using the official `@modelcontextprotocol/sdk`.
4. **Project Boilerplate Generator**: Emits standard project configuration files using Handlebars templates to produce a clean, self-contained project (e.g. `package.json`, `tsconfig.json`, `bunfig.toml`, `.env.example`, `README.md`).
5. **Runtime Validator**: Spawns standard Bun subprocesses inside the output folder to execute `bun install`, check TypeScript compilation via `bunx tsc --noEmit`, and perform a JSON-RPC stdio handshake validation to guarantee runtime safety.

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
│   ├── index.ts                # Main export entrypoint
│   ├── cli/                    # CLI execution routing (Commander.js)
│   │   ├── index.ts            # Commander setup and callbacks
│   ├── parser/                 # Resolver and intermediate translator
│   │   ├── parser.ts           # Spec resolving logic
│   │   └── translator.ts       # Maps resolved spec to intermediate models
│   ├── models/                 # IIM TypeScript interface declarations
│   │   └── types.ts
│   ├── generator/              # Code synthesis engines
│   │   ├── project-generator.ts# Writes configuration files
│   │   ├── schema-generator.ts # Programmatically writes Zod schemas
│   │   ├── server-generator.ts # Synthesizes main server listener
│   │   └── tool-generator.ts   # Emits fetch wrappers and parameters
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
* `--no-install`: Skip automatic running of `bun install` during verification

### 3. Validate a server
```bash
mcpgen validate ./my-mcp-server
```
Compiles the project, type-checks the generated TypeScript code, and performs a live JSON-RPC handshake verification.

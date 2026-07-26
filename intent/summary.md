# MCP Generator — Project Summary

MCP Generator is a **Bun + TypeScript** CLI tool that parses OpenAPI 3.x specifications (JSON/YAML) and compiles them into production-ready, fully-validated **Model Context Protocol (MCP)** servers with zero manual implementation.

## Key Features

1. **Parser & resolver**: Dereferences spec components and `$ref` pointers.
2. **Intermediate translation (IIM)**: Converts endpoints, security schemes, parameter hierarchies, and JSON request bodies into a standardized internal representation.
3. **AST-driven code generation**:
   - Generates modular, tag-grouped tool files (`src/tools/`) performing standard HTTP requests via Bun's native `fetch`.
   - Generates Zod validation schemas (`src/schemas.ts`) supporting complex nested arrays, enums, and objects.
   - Integrates `zod-to-json-schema` to dynamically expose tool shapes to MCP clients during runtime listing.
4. **Boilerplate templates**: Creates a ready-to-run Bun project (`tsconfig.json`, `bunfig.toml`, `.env.example`, `README.md`, `package.json`).
5. **CLI CLI interfaces**:
   - `mcpgen generate <spec>`: Generates and validates the MCP server.
   - `mcpgen validate [dir]`: Run type-check compiler validation and executes a live stdio JSON-RPC `initialize` handshake.

## Package Architecture

```
src/
├── index.ts                 # Main module exports
├── cli/                     # CLI commands routing (Commander.js)
├── parser/                  # Resolving refs & translating to intermediate model
├── models/                  # Intermediate Data Models (types.ts)
├── generator/               # Code-Gen Engines (project, schema, server, tools)
└── runtime/                 # Subprocess runtime verification & handshake check
```

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
import { existsSync } from "node:fs";
import { join } from "node:path";

const program = new Command();

program
  .name("mcpgen")
  .description("Generate MCP servers from OpenAPI specs")
  .version("1.0.0");

program
  .command("generate <spec>")
  .description("Generate an MCP server from an OpenAPI specification")
  .option("-o, --out-dir <dir>", "Output directory", "./generated-mcp-server")
  .option("-f, --force", "Force overwrite", false)
  .action(async (specPath, options) => {
    try {
      const outDir = options.outDir || options["out-dir"] || "./generated-mcp-server";
      
      if (existsSync(outDir) && !options.force) {
        console.error(`❌ Output directory "${outDir}" already exists. Use --force to overwrite.`);
        process.exit(1);
      }

      console.log(`⚙️  Parsing OpenAPI specification...`);
      const spec = await parseOpenApiSpec(specPath);
      const project = translateToIIM(spec);
      
      console.log(`📦 Building Internal Intermediate Model...`);
      
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
    } catch (err: any) {
      console.error(`❌ Error during generation: ${err?.message || err}`);
      process.exit(1);
    }
  });

program
  .command("validate [dir]")
  .description("Validate generated MCP server directory")
  .action(async (dir) => {
    try {
      const targetDir = dir || "./generated-mcp-server";
      console.log(`🔍 Validating MCP Server at "${targetDir}"...`);
      const valid = await runVerification(targetDir);
      if (valid) {
        console.log("✅ Project validation passed compilation check.");
      } else {
        console.error("❌ Project validation failed compilation check.");
        process.exit(1);
      }
    } catch (err: any) {
      console.error(`❌ Validation error: ${err?.message || err}`);
      process.exit(1);
    }
  });

program.parse();

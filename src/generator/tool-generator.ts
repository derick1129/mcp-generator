import { MCPProject } from "../models/types.ts";
import { Project, VariableDeclarationKind } from "ts-morph";

export function generateTools(project: MCPProject): Map<string, string> {
  const files = new Map<string, string>();
  const tsProject = new Project({ useInMemoryFileSystem: true });

  const sourceFile = tsProject.createSourceFile(
    "default.ts",
    `import { z } from "zod";\nimport * as schemas from "../schemas.js";\n`
  );

  for (const tool of project.tools) {
    let camelName = tool.name.replace(/-([a-z0-9])/gi, (_, c) => c.toUpperCase());
    if (/^[^a-zA-Z_$]/.test(camelName)) {
      camelName = `_${camelName}`;
    }
    const inputSchemaName = `schemas.${camelName}InputSchema`;

    const functionBody = `
      const baseUrl = process.env.API_BASE_URL || "http://localhost:8000";
      const path = "${tool.endpoint.path}".replace(/\\{(\\w+)\\}/g, (_, name) => encodeURIComponent((args as any)[name]));
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
      declarations: [
        {
          name: `${camelName}Tool`,
          initializer: `{\n  name: ${JSON.stringify(tool.name)},\n  description: ${JSON.stringify(tool.description)},\n  inputSchema: ${inputSchemaName},\n  handler: async (args: any) => {${functionBody}}\n}`
        }
      ]
    });
  }

  files.set("default.ts", sourceFile.getFullText());
  return files;
}

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
    const pathLiteral = JSON.stringify(tool.endpoint.path);

    const pathParamNames = tool.endpoint.parameters.filter(p => p.in === "path").map(p => p.name);
    const queryParamNames = tool.endpoint.parameters.filter(p => p.in === "query").map(p => p.name);
    const headerParamNames = tool.endpoint.parameters.filter(p => p.in === "header").map(p => p.name);
    const hasRequestBody = !!tool.endpoint.requestBody;

    const functionBody = `
      const baseUrl = process.env.API_BASE_URL || ${JSON.stringify(project.baseUrl || "http://localhost:8000")};
      const path = ${pathLiteral}.replace(/\\{(\\w+)\\}/g, (_, name) => encodeURIComponent((args as any)?.[name]));
      const url = new URL(baseUrl + path);
      
      const queryParamNames: string[] = ${JSON.stringify(queryParamNames)};
      const headerParamNames: string[] = ${JSON.stringify(headerParamNames)};
      const pathParamNames: string[] = ${JSON.stringify(pathParamNames)};
      const hasRequestBody = ${hasRequestBody};

      const headers: Record<string, string> = {};
      const body: Record<string, any> = {};

      if (args) {
        for (const [key, value] of Object.entries(args)) {
          if (value === undefined) continue;
          if (pathParamNames.includes(key)) {
            continue;
          } else if (queryParamNames.includes(key)) {
            url.searchParams.append(key, String(value));
          } else if (headerParamNames.includes(key)) {
            headers[key] = String(value);
          } else if (hasRequestBody) {
            body[key] = value;
          } else {
            url.searchParams.append(key, String(value));
          }
        }
      }

      const fetchOptions: RequestInit = {
        method: "${tool.endpoint.method.toUpperCase()}",
        headers
      };

      if (Object.keys(body).length > 0) {
        headers["Content-Type"] = "application/json";
        fetchOptions.body = JSON.stringify(body);
      }

      const response = await fetch(url.toString(), fetchOptions);

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

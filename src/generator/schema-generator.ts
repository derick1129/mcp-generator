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
        let typeStr = prop.type;
        if (typeStr === "integer") {
          typeStr = "number";
        }
        let line = `${prop.name}: z.${typeStr}()`;
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

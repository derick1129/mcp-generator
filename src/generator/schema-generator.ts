import { MCPProject, PropertyDefinition } from "../models/types.ts";
import { Project, VariableDeclarationKind } from "ts-morph";

function buildZodType(prop: PropertyDefinition): string {
  let expr = "";

  if (prop.enum && prop.enum.length > 0) {
    const formattedEnum = prop.enum.map((e) => JSON.stringify(e)).join(", ");
    expr = `z.enum([${formattedEnum}])`;
  } else if (prop.type === "string") {
    expr = "z.string()";
  } else if (prop.type === "number" || prop.type === "integer") {
    expr = "z.number()";
  } else if (prop.type === "boolean") {
    expr = "z.boolean()";
  } else if (prop.type === "array") {
    if (prop.items) {
      expr = `z.array(${buildZodType(prop.items)})`;
    } else {
      expr = "z.array(z.any())";
    }
  } else if (prop.type === "object") {
    if (prop.properties && prop.properties.length > 0) {
      const innerProps = prop.properties.map((p) => {
        const pKey = /^[a-zA-Z_$][a-zA-Z0-9_$]*$/.test(p.name) ? p.name : JSON.stringify(p.name);
        let pExpr = `${pKey}: ${buildZodType(p)}`;
        if (p.description) {
          pExpr += `.describe(${JSON.stringify(p.description)})`;
        }
        if (!p.required) {
          pExpr += ".optional()";
        }
        return pExpr;
      });
      expr = `z.object({\n  ${innerProps.join(",\n  ")}\n})`;
    } else {
      expr = "z.record(z.any())";
    }
  } else {
    expr = "z.any()";
  }

  return expr;
}

export function generateZodSchemas(project: MCPProject): string {
  const tsProject = new Project({ useInMemoryFileSystem: true });
  const sourceFile = tsProject.createSourceFile("schemas.ts", `import { z } from "zod";\n`);

  for (const tool of project.tools) {
    let camelName = tool.name.replace(/-([a-z0-9])/gi, (_, c) => c.toUpperCase());
    if (/^[^a-zA-Z_$]/.test(camelName)) {
      camelName = `_${camelName}`;
    }
    const inputSchemaName = `${camelName}InputSchema`;
    
    const properties: string[] = [];
    if (tool.inputSchema.properties) {
      for (const prop of tool.inputSchema.properties) {
        const propKey = /^[a-zA-Z_$][a-zA-Z0-9_$]*$/.test(prop.name) ? prop.name : JSON.stringify(prop.name);
        let line = `${propKey}: ${buildZodType(prop)}`;
        if (prop.description) {
          line += `.describe(${JSON.stringify(prop.description)})`;
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

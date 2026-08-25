import {
  MCP_PROTOCOL_VERSION,
  PropertyDefinition,
  ToolDefinition,
  EndpointDefinition,
  SchemaDefinition,
  RequestBodyDefinition,
  ResponseDefinition,
  SecurityScheme,
  MCPProject
} from "../models/types.ts";

function cleanKebab(str: string): string {
  return str
    .replace(/([a-z0-9])([A-Z])/g, "$1-$2")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function resolveSchema(schema: any): SchemaDefinition {
  if (!schema) return { type: "object", properties: [] };
  const type = schema.type || "object";
  const properties: PropertyDefinition[] = [];

  if (schema.properties) {
    for (const [key, prop] of Object.entries(schema.properties) as any[]) {
      const resolvedProp = resolveSchema(prop);
      properties.push({
        name: key,
        type: resolvedProp.type,
        required: Array.isArray(schema.required) && schema.required.includes(key),
        description: prop.description,
        enum: prop.enum,
        properties: resolvedProp.properties,
        items: resolvedProp.items
      });
    }
  }

  const itemResolved = schema.items ? resolveSchema(schema.items) : undefined;
  const items: PropertyDefinition | undefined = itemResolved
    ? {
        name: "",
        type: itemResolved.type,
        required: true,
        description: itemResolved.description,
        properties: itemResolved.properties,
        items: itemResolved.items
      }
    : undefined;

  return {
    type,
    description: schema.description,
    properties: properties.length > 0 ? properties : undefined,
    items
  };
}

export function translateToIIM(spec: any): MCPProject {
  const title = spec.info?.title || "mcp-server";
  const version = spec.info?.version || "1.0.0";
  const baseUrl = spec.servers?.[0]?.url || "http://localhost:8000";
  const tools: ToolDefinition[] = [];

  const paths = spec.paths || {};
  for (const [path, methods] of Object.entries(paths)) {
    for (const [method, operation] of Object.entries(methods as any)) {
      if (!["get", "post", "put", "patch", "delete"].includes(method.toLowerCase())) continue;

      const op = operation as any;
      const normalizedMethod = method.toLowerCase() as 'get' | 'post' | 'put' | 'patch' | 'delete';
      const operationId = op.operationId || `${normalizedMethod}-${path.replace(/[{}]/g, "").replace(/\//g, "-")}`;
      const name = cleanKebab(operationId);

      const parameters = (op.parameters || []).map((p: any) => ({
        name: p.name,
        in: p.in,
        required: !!p.required,
        description: p.description,
        schema: resolveSchema(p.schema || { type: p.type || "string" })
      }));

      // Flatten parameters into inputProperties preserving items and properties
      const inputProperties: PropertyDefinition[] = parameters.map((p: any) => ({
        name: p.name,
        type: p.schema.type,
        required: p.required,
        description: p.description,
        items: p.schema.items,
        properties: p.schema.properties
      }));

      let requestBodyDef: RequestBodyDefinition | undefined = undefined;
      if (op.requestBody) {
        const content = op.requestBody.content || {};
        const mediaType = content["application/json"] || Object.values(content)[0] as any;
        const schema = mediaType?.schema ? resolveSchema(mediaType.schema) : { type: "object" };
        requestBodyDef = {
          description: op.requestBody.description,
          required: !!op.requestBody.required,
          schema
        };
        if (schema.properties) {
          for (const prop of schema.properties) {
            if (!inputProperties.some(p => p.name === prop.name)) {
              inputProperties.push(prop);
            }
          }
        }
      }

      const responses: ResponseDefinition[] = [];
      if (op.responses) {
        for (const [statusCode, resp] of Object.entries(op.responses) as any[]) {
          const content = resp.content || {};
          const mediaType = content["application/json"] || Object.values(content)[0] as any;
          const schema = mediaType?.schema ? resolveSchema(mediaType.schema) : undefined;
          responses.push({
            statusCode,
            description: resp.description,
            schema
          });
        }
      }

      const securityRequirement = op.security ? op.security.flatMap((s: any) => Object.keys(s)) : undefined;

      const endpoint: EndpointDefinition = {
        id: name,
        operationId,
        method: normalizedMethod,
        path,
        summary: op.summary || "",
        description: op.description,
        parameters,
        requestBody: requestBodyDef,
        responses,
        securityRequirement
      };

      tools.push({
        name,
        description: op.summary || op.description || `Execute ${normalizedMethod} request to ${path}`,
        endpoint,
        inputSchema: {
          type: "object",
          properties: inputProperties
        }
      });
    }
  }

  const securitySchemes: SecurityScheme[] = [];
  if (spec.components?.securitySchemes) {
    for (const [id, scheme] of Object.entries(spec.components.securitySchemes) as any[]) {
      if (scheme.type === "apiKey") {
        securitySchemes.push({
          id,
          type: "apiKey",
          name: scheme.name,
          in: scheme.in
        });
      } else if (scheme.type === "http") {
        securitySchemes.push({
          id,
          type: "http",
          scheme: scheme.scheme
        });
      }
    }
  }

  return {
    name: cleanKebab(title),
    version,
    protocolVersion: MCP_PROTOCOL_VERSION,
    outputDirectory: "./generated-mcp-server",
    tools,
    securitySchemes,
    baseUrl
  };
}

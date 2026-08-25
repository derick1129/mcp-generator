export const MCP_PROTOCOL_VERSION = "2026-07-28" as const;
export type MCPProtocolVersion = typeof MCP_PROTOCOL_VERSION;

/**
 * Per-request metadata required by MCP 2026-07-28 (stateless protocol).
 * Keys follow the spec's namespaced `_meta` conventions.
 */
export interface RequestMeta {
  protocolVersion: MCPProtocolVersion;
  clientCapabilities?: Record<string, any>;
  clientInfo?: {
    name: string;
    version: string;
  };
  [key: string]: any;
}

/** JSON-RPC error codes used by generated servers. */
export const INVALID_PARAMS_ERROR_CODE = -32602 as const;
/** Error code returned for UnsupportedProtocolVersionError responses. */
export const UNSUPPORTED_PROTOCOL_VERSION_ERROR_CODE = -32022 as const;

export interface PropertyDefinition {
  name: string;
  type: string;
  required: boolean;
  description?: string;
  enum?: string[];
  properties?: PropertyDefinition[];
  items?: PropertyDefinition;
}

export interface SchemaDefinition {
  name?: string;
  type: string;
  description?: string;
  properties?: PropertyDefinition[];
  items?: PropertyDefinition;
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
  name?: string;
  in?: 'header' | 'query';
  scheme?: 'bearer';
}

export interface ToolDefinition {
  name: string;
  description: string;
  endpoint: EndpointDefinition;
  inputSchema: SchemaDefinition;
  outputSchema?: SchemaDefinition;
}

export interface MCPProject {
  name: string;
  version: string;
  protocolVersion: MCPProtocolVersion;
  outputDirectory: string;
  tools: ToolDefinition[];
  securitySchemes: SecurityScheme[];
  baseUrl?: string;
}


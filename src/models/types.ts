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
  outputDirectory: string;
  tools: ToolDefinition[];
  securitySchemes: SecurityScheme[];
}

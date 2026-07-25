import { expect, test } from "bun:test";
import { parseOpenApiSpec } from "../src/parser/parser.ts";
import { translateToIIM } from "../src/parser/translator.ts";

test("translates simple OpenAPI to intermediate model", async () => {
  const spec = await parseOpenApiSpec("tests/fixtures/simple-spec.yaml");
  const project = translateToIIM(spec);

  expect(project.name).toBe("simple-test-api");
  expect(project.version).toBe("1.0.0");
  expect(project.tools.length).toBe(1);
  const tool = project.tools[0];
  expect(tool.name).toBe("get-user");
  expect(tool.endpoint.method).toBe("get");
  expect(tool.endpoint.path).toBe("/users/{id}");
  expect(tool.endpoint.parameters.length).toBe(1);
  expect(tool.endpoint.parameters[0].name).toBe("id");
  expect(tool.endpoint.parameters[0].in).toBe("path");
  expect(tool.endpoint.parameters[0].required).toBe(true);
});

test("translates spec with request body and security schemes", async () => {
  const spec = {
    openapi: "3.0.0",
    info: {
      title: "Complex Spec API",
      version: "2.0.0"
    },
    paths: {
      "/items": {
        post: {
          summary: "Create item",
          operationId: "createItem",
          security: [{ apiKeyAuth: [] }],
          requestBody: {
            required: true,
            description: "Item to create",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  required: ["name"],
                  properties: {
                    name: { type: "string", description: "Item name" },
                    price: { type: "number" }
                  }
                }
              }
            }
          },
          responses: {
            "201": {
              description: "Created",
              content: {
                "application/json": {
                  schema: {
                    type: "object",
                    properties: {
                      id: { type: "string" }
                    }
                  }
                }
              }
            }
          }
        }
      }
    },
    components: {
      securitySchemes: {
        apiKeyAuth: {
          type: "apiKey",
          name: "X-API-Key",
          in: "header"
        },
        bearerAuth: {
          type: "http",
          scheme: "bearer"
        }
      }
    }
  };

  const project = translateToIIM(spec);

  expect(project.name).toBe("complex-spec-api");
  expect(project.version).toBe("2.0.0");
  expect(project.securitySchemes.length).toBe(2);
  expect(project.securitySchemes[0].id).toBe("apiKeyAuth");
  expect(project.securitySchemes[0].type).toBe("apiKey");

  const tool = project.tools[0];
  expect(tool.name).toBe("create-item");
  expect(tool.endpoint.method).toBe("post");
  expect(tool.endpoint.requestBody).toBeDefined();
  expect(tool.endpoint.requestBody?.required).toBe(true);
  expect(tool.endpoint.securityRequirement).toEqual(["apiKeyAuth"]);
  expect(tool.inputSchema.properties?.length).toBe(2);
});

test("preserves parameter items and properties in inputProperties", async () => {
  const spec = {
    openapi: "3.0.0",
    info: { title: "---Array Param API---", version: "1.0.0" },
    paths: {
      "/search": {
        get: {
          operationId: "searchTags",
          parameters: [
            {
              name: "tags",
              in: "query",
              required: false,
              schema: {
                type: "array",
                items: { type: "string" }
              }
            }
          ],
          responses: { "200": { description: "OK" } }
        }
      }
    }
  };

  const project = translateToIIM(spec);
  expect(project.name).toBe("array-param-api");
  const tool = project.tools[0];
  const tagsProp = tool.inputSchema.properties?.find((p) => p.name === "tags");
  expect(tagsProp).toBeDefined();
  expect(tagsProp?.type).toBe("array");
  expect(tagsProp?.items).toBeDefined();
  expect(tagsProp?.items?.type).toBe("string");
});

test("resolves array item schemas recursively for objects in arrays", async () => {
  const spec = {
    openapi: "3.0.0",
    info: { title: "Nested Array API", version: "1.0.0" },
    paths: {
      "/batch": {
        post: {
          operationId: "batchInsert",
          requestBody: {
            required: true,
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    items: {
                      type: "array",
                      items: {
                        type: "object",
                        properties: {
                          id: { type: "string" },
                          value: { type: "number" }
                        }
                      }
                    }
                  }
                }
              }
            }
          },
          responses: { "200": { description: "OK" } }
        }
      }
    }
  };

  const project = translateToIIM(spec);
  const tool = project.tools[0];
  const itemsProp = tool.inputSchema.properties?.find((p) => p.name === "items");
  expect(itemsProp).toBeDefined();
  expect(itemsProp?.type).toBe("array");
  expect(itemsProp?.items?.type).toBe("object");
  expect(itemsProp?.items?.properties?.length).toBe(2);
  expect(itemsProp?.items?.properties?.[0].name).toBe("id");
});

test("extracts first server URL from spec as baseUrl", async () => {
  const spec = {
    openapi: "3.0.0",
    info: { title: "Server Spec API", version: "1.0.0" },
    servers: [{ url: "https://api.example.com/v1" }],
    paths: {}
  };

  const project = translateToIIM(spec);
  expect(project.baseUrl).toBe("https://api.example.com/v1");
});


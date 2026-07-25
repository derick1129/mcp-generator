import SwaggerParser from "@apidevtools/swagger-parser";

export async function parseOpenApiSpec(filePathOrUrl: string): Promise<any> {
  try {
    // validate and dereference the spec
    const api = await SwaggerParser.dereference(filePathOrUrl);
    return api;
  } catch (error) {
    throw new Error(`Failed to parse OpenAPI spec: ${(error as Error).message}`);
  }
}

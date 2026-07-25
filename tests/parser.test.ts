import { expect, test } from "bun:test";
import { parseOpenApiSpec } from "../src/parser/parser.ts";

test("parses and dereferences an OpenAPI spec", async () => {
  const spec = await parseOpenApiSpec("tests/fixtures/simple-spec.yaml");
  expect(spec.info.title).toBe("Simple Test API");
  // Verify dereferencing succeeded
  const responseSchema = spec.paths["/users/{id}"].get.responses["200"].content["application/json"].schema;
  expect(responseSchema.properties.name.type).toBe("string");
});

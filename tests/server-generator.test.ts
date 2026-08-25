import { expect, test, describe } from "bun:test";
import { parseOpenApiSpec } from "../src/parser/parser.ts";
import { translateToIIM } from "../src/parser/translator.ts";
import { generateServerFile } from "../src/generator/server-generator.ts";

describe("generated server.ts (MCP 2026-07-28)", () => {
  const getServerFile = async () => {
    const spec = await parseOpenApiSpec("tests/fixtures/simple-spec.yaml");
    const project = translateToIIM(spec);
    return generateServerFile(project);
  };

  test("registers server/discover handler with supportedVersions array", async () => {
    const s = await getServerFile();
    expect(s).toContain('"server/discover"');
    expect(s).toContain("supportedVersions");
    expect(s).toContain("SUPPORTED_VERSIONS = [PROTOCOL_VERSION]");
  });

  test("discover response carries resultType and namespaced serverInfo in _meta", async () => {
    const s = await getServerFile();
    expect(s).toContain('"io.modelcontextprotocol/serverInfo"');
    expect(s).toContain('resultType: "complete"');
  });

  test("tools/list emits JSON Schema 2020-12 via z.toJSONSchema and cacheable fields", async () => {
    const s = await getServerFile();
    // Zod v4 native converter targeting draft 2020-12
    expect(s).toContain("z.toJSONSchema");
    expect(s).not.toContain("zod-to-json-schema");
    // CacheableResult required fields on list results
    expect(s).toContain("ttlMs");
    expect(s).toContain('cacheScope: "public"');
  });

  test("tools/call returns -32602 protocol error for unknown tools", async () => {
    const s = await getServerFile();
    expect(s).toContain("-32602");
    expect(s).toContain("Unknown tool");
    expect(s).not.toContain('new Error("Tool not found")');
  });

  test("tools/call validates _meta and forwards it to handlers", async () => {
    const s = await getServerFile();
    expect(s).toContain('"io.modelcontextprotocol/protocolVersion"');
    expect(s).toContain("-32022");
    expect(s).toContain("Unsupported protocol version");
    // handler invoked with (args, meta)
    expect(s).toContain("tool.handler(args, meta)");
  });

  test("emits no legacy initialize handshake", async () => {
    const s = await getServerFile();
    expect(s).not.toContain('"initialize"');
    expect(s).not.toContain("notifications/initialized");
  });

  test("every result includes resultType complete and per-request serverInfo _meta", async () => {
    const s = await getServerFile();
    // discover + tools/list + tools/call all route through withResultMeta
    const matches = s.match(/resultType: "complete"/g) ?? [];
    expect(matches.length).toBeGreaterThanOrEqual(1);
    const uses = s.match(/withResultMeta\(/g) ?? [];
    expect(uses.length).toBeGreaterThanOrEqual(3);
  });
});

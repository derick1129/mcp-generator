# MCP 2026-07-28 Server Generator — Spec Compliance Notes

Corrections applied vs. the original plan snippets (verified against the published
2026-07-28 specification at modelcontextprotocol.io):

1. `server/discover` response uses `supportedVersions: ["2026-07-28"]` (array),
   NOT a top-level `protocolVersion` string.
2. `serverInfo` lives inside `_meta["io.modelcontextprotocol/serverInfo"]`.
3. Every result carries required `resultType: "complete"`.
4. List results require `ttlMs` and `cacheScope` (CacheableResult interface).
5. Unknown tool -> JSON-RPC protocol error `-32602`. Input validation failures
   inside a tool handler -> tool execution errors (`isError: true`), so models
   can self-correct.
6. Unsupported requested protocol version -> `-32022` UnsupportedProtocolVersionError
   with `data.supported`.
7. JSON Schema 2020-12 emitted via Zod v4's native `z.toJSONSchema()` —
   `zod-to-json-schema@^3` has no 2020-12 target and is dropped.
8. Tools listed in deterministic (registry insertion) order; every request MUST
   carry namespaced `_meta` keys
   (`io.modelcontextprotocol/protocolVersion|clientCapabilities|clientInfo`),
   forwarded to handlers as `meta`.
9. No `initialize`/`notifications/initialized` handshake anywhere.

import { spawnSync, spawn } from "node:child_process";

/**
 * Stateless MCP 2026-07-28 verification pipeline.
 *
 * Replaces the legacy initialize handshake with three protocol checks:
 *   1. server/discover  -> response must include supportedVersions ["2026-07-28"]
 *   2. tools/list       -> stateless, no handshake; response must include a tools array
 *   3. tools/call (bad) -> unknown tool must yield JSON-RPC error code -32602
 *
 * Requests carry namespaced _meta keys per the spec.
 */
export async function runVerification(outputDir: string): Promise<boolean> {
  // 1. Dependency installation
  const install = spawnSync("bun", ["install"], { cwd: outputDir });
  if (install.status !== 0) return false;

  // 2. TypeScript compilation check
  const compile = spawnSync("bunx", ["tsc", "--noEmit"], { cwd: outputDir });
  if (compile.status !== 0) return false;

  // 3. Stateless protocol checks over stdio
  return new Promise((resolve) => {
    const serverProcess = spawn("bun", ["src/index.ts"], {
      cwd: outputDir,
      stdio: ["pipe", "pipe", "inherit"]
    });

    let stdoutData = "";
    let isResolved = false;
    /** Which check each JSON-RPC id belongs to. */
    const idToCheck: Record<number, string> = {
      1: "discover",
      2: "list",
      3: "error"
    };
    const passedChecks = new Set<string>();

    const meta = {
      "io.modelcontextprotocol/protocolVersion": "2026-07-28",
      "io.modelcontextprotocol/clientInfo": { name: "mcpgen-validator", version: "1.0.0" },
      "io.modelcontextprotocol/clientCapabilities": {}
    };

    const discoverRequest = {
      jsonrpc: "2.0",
      id: 1,
      method: "server/discover",
      params: { _meta: meta }
    };

    const listRequest = {
      jsonrpc: "2.0",
      id: 2,
      method: "tools/list",
      params: { _meta: meta }
    };

    const badCallRequest = {
      jsonrpc: "2.0",
      id: 3,
      method: "tools/call",
      params: {
        name: "__mcpgen_nonexistent_tool__",
        arguments: {},
        _meta: meta
      }
    };

    const cleanupAndResolve = (result: boolean, why?: string) => {
      if (!isResolved) {
        isResolved = true;
        if (why) console.error(`[mcpgen-validator] ${why}`);
        try {
          serverProcess.kill("SIGTERM");
        } catch {}
        resolve(result);
      }
    };

    const handleLine = (line: string): boolean => {
      line = line.trim();
      if (!line.startsWith("{")) return false;
      let msg: any;
      try {
        msg = JSON.parse(line);
      } catch {
        return false;
      }

      const check = idToCheck[msg.id];
      if (!check) return false;

      if (check === "discover") {
        const versions = msg.result?.supportedVersions;
        if (Array.isArray(versions) && versions.includes("2026-07-28")) {
          passedChecks.add("discover");
          try {
            serverProcess.stdin.write(JSON.stringify(listRequest) + "\n");
          } catch {
            cleanupAndResolve(false, "failed to send tools/list");
          }
          return true;
        }
        cleanupAndResolve(false, "server/discover did not advertise 2026-07-28");
        return true;
      }

      if (check === "list") {
        if (Array.isArray(msg.result?.tools)) {
          passedChecks.add("list");
          try {
            serverProcess.stdin.write(JSON.stringify(badCallRequest) + "\n");
          } catch {
            cleanupAndResolve(false, "failed to send bad tools/call");
          }
          return true;
        }
        cleanupAndResolve(false, "stateless tools/list failed or returned no tools array");
        return true;
      }

      if (check === "error") {
        if (msg.error?.code === -32602) {
          passedChecks.add("error");
          if (passedChecks.size === 3) {
            cleanupAndResolve(true);
            return true;
          }
        } else {
          cleanupAndResolve(
            false,
            `unknown-tool call expected error code -32602, got ${JSON.stringify(msg.error?.code ?? msg.result)}`
          );
        }
        return true;
      }

      return false;
    };

    let buffer = "";
    serverProcess.stdout.on("data", (chunk) => {
      stdoutData += chunk.toString();
      buffer += chunk.toString();
      const lines = buffer.split("\n");
      buffer = lines.pop() ?? "";
      for (const line of lines) {
        if (handleLine(line)) break;
      }
    });

    serverProcess.on("error", () => {
      cleanupAndResolve(false, "failed to start generated server process");
    });

    const timer = setTimeout(() => {
      cleanupAndResolve(
        false,
        `timed out; checks passed: [${Array.from(passedChecks).join(", ") || "none"}]`
      );
    }, 10000);

    serverProcess.on("exit", () => clearTimeout(timer));

    // Stateless: fire the first request immediately, no handshake.
    try {
      serverProcess.stdin.write(JSON.stringify(discoverRequest) + "\n");
    } catch {
      cleanupAndResolve(false, "failed to send server/discover");
    }
  });
}

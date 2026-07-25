import { spawnSync, spawn } from "node:child_process";

export async function runVerification(outputDir: string): Promise<boolean> {
  // Basic verification: test Bun install and runtime compilation check
  const install = spawnSync("bun", ["install"], { cwd: outputDir });
  if (install.status !== 0) return false;

  const compile = spawnSync("bunx", ["tsc", "--noEmit"], { cwd: outputDir });
  if (compile.status !== 0) return false;

  // MCP Handshake check
  return new Promise((resolve) => {
    const serverProcess = spawn("bun", ["src/index.ts"], {
      cwd: outputDir,
      stdio: ["pipe", "pipe", "inherit"]
    });

    let stdoutData = "";
    let isResolved = false;

    const cleanupAndResolve = (result: boolean) => {
      if (!isResolved) {
        isResolved = true;
        try {
          serverProcess.kill("SIGTERM");
        } catch {}
        resolve(result);
      }
    };

    serverProcess.stdout.on("data", (chunk) => {
      stdoutData += chunk.toString();
      if (stdoutData.includes('"result"') || stdoutData.includes('"protocolVersion"')) {
        cleanupAndResolve(true);
      }
    });

    serverProcess.on("error", () => {
      cleanupAndResolve(false);
    });

    const initRequest = {
      jsonrpc: "2.0",
      id: 1,
      method: "initialize",
      params: {
        protocolVersion: "2024-11-05",
        capabilities: {},
        clientInfo: { name: "mcpgen-validator", version: "1.0.0" }
      }
    };

    try {
      serverProcess.stdin.write(JSON.stringify(initRequest) + "\n");
    } catch {
      cleanupAndResolve(false);
    }

    const timer = setTimeout(() => {
      cleanupAndResolve(false);
    }, 5000);

    serverProcess.on("exit", () => clearTimeout(timer));
  });
}

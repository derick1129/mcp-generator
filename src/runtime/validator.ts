import { spawnSync } from "node:child_process";

export async function runVerification(outputDir: string): Promise<boolean> {
  // Basic verification: test Bun install and runtime compilation check
  const install = spawnSync("bun", ["install"], { cwd: outputDir });
  if (install.status !== 0) return false;

  const compile = spawnSync("bunx", ["tsc", "--noEmit"], { cwd: outputDir });
  return compile.status === 0;
}

import { expect, test } from "bun:test";
import { spawnSync } from "node:child_process";
import { rm } from "node:fs/promises";

test("runs CLI and generates fully compilable project", async () => {
  try {
    await rm("tests/integration-out", { recursive: true, force: true });
  } catch {}

  const result = spawnSync("bun", [
    "src/cli/index.ts",
    "generate",
    "tests/fixtures/simple-spec.yaml",
    "-o",
    "tests/integration-out",
    "-f"
  ]);

  expect(result.status).toBe(0);
  expect(await Bun.file("tests/integration-out/src/server.ts").exists()).toBe(true);
});

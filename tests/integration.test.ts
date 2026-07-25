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

test("rejects overwriting existing output directory without --force flag", () => {
  const result = spawnSync("bun", [
    "src/cli/index.ts",
    "generate",
    "tests/fixtures/simple-spec.yaml",
    "-o",
    "tests/integration-out"
  ]);

  expect(result.status).toBe(1);
});

test("runs CLI validate command on generated project", () => {
  const result = spawnSync("bun", [
    "src/cli/index.ts",
    "validate",
    "tests/integration-out"
  ]);

  expect(result.status).toBe(0);
});

import { describe, it, expect, beforeEach, afterEach } from "bun:test";
import { mkdtemp, writeFile, rm, mkdir } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { scanWorkflows } from "../src/api/services/workflow-scanner.ts";

const VALID_WORKFLOW = `
id: hello-world
name: Hello World
version: "1.0"
flow:
  - echo:
      type: exec
      run: echo hello
`.trim();

const INVALID_YAML = `
id: [broken yaml
flow: {
`.trim();

describe("workflow-scanner", () => {
  let dir: string;

  beforeEach(async () => {
    dir = await mkdtemp(join(tmpdir(), "duckflux-scan-"));
  });

  afterEach(async () => {
    await rm(dir, { recursive: true, force: true });
  });

  it("returns empty array for empty directory", async () => {
    const result = await scanWorkflows(dir);
    expect(result).toEqual([]);
  });

  it("returns empty array for missing directory", async () => {
    const result = await scanWorkflows("/nonexistent");
    expect(result).toEqual([]);
  });

  it("scans .yaml files and returns metadata", async () => {
    await writeFile(join(dir, "hello.yaml"), VALID_WORKFLOW);

    const result = await scanWorkflows(dir);
    expect(result).toHaveLength(1);
    expect(result[0].name).toBe("Hello World");
    expect(result[0].id).toBe("hello-world");
    expect(result[0].version).toBe("1.0");
  });

  it("scans .yml files too", async () => {
    await writeFile(join(dir, "hello.yml"), VALID_WORKFLOW);

    const result = await scanWorkflows(dir);
    expect(result).toHaveLength(1);
    expect(result[0].relativePath).toBe("hello.yml");
  });

  it("skips invalid YAML without aborting", async () => {
    await writeFile(join(dir, "valid.yaml"), VALID_WORKFLOW);
    await writeFile(join(dir, "broken.yaml"), INVALID_YAML);

    const result = await scanWorkflows(dir);
    expect(result).toHaveLength(1);
    expect(result[0].name).toBe("Hello World");
  });

  it("scans nested directories recursively", async () => {
    const sub = join(dir, "subdir");
    await mkdir(sub);
    await writeFile(join(sub, "nested.yaml"), VALID_WORKFLOW);

    const result = await scanWorkflows(dir);
    expect(result).toHaveLength(1);
    expect(result[0].relativePath).toBe("subdir/nested.yaml");
  });

  it("uses relative path as id when workflow has no id", async () => {
    const noId = VALID_WORKFLOW.replace("id: hello-world\n", "");
    await writeFile(join(dir, "my-flow.yaml"), noId);

    const result = await scanWorkflows(dir);
    expect(result[0].id).toBe("my-flow");
  });
});

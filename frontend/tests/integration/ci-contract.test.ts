import { readFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";
import { parse } from "yaml";

type JsonRecord = Record<string, unknown>;

const frontendRoot = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const packagePath = resolve(frontendRoot, "package.json");
const workflowPath = resolve(frontendRoot, "../.github/workflows/ci.yml");

function asRecord(value: unknown, label: string): JsonRecord {
  expect(value, label).toBeTypeOf("object");
  expect(value, label).not.toBeNull();
  expect(Array.isArray(value), label).toBe(false);
  return value as JsonRecord;
}

function asArray(value: unknown, label: string): unknown[] {
  expect(Array.isArray(value), label).toBe(true);
  return value as unknown[];
}

describe("CI and package-script contract", () => {
  it("pins the development supervisor and complete browser-gate graph", async () => {
    const packageMetadata = asRecord(
      JSON.parse(await readFile(packagePath, "utf8")),
      "package metadata",
    );
    const scripts = asRecord(packageMetadata.scripts, "package scripts");

    expect(scripts.dev).toBe(
      'npm run dev:preflight && concurrently --kill-others --success first "npm:dev:web" "npm:dev:server"',
    );
    expect(scripts.check).toBe(
      "npm run lint && npm run typecheck && npm test && npm run test:e2e",
    );
    expect(scripts["test:e2e"]).toBe(
      "npm run build && node tests/e2e/server-harness.mjs",
    );
  });

  it("runs the complete locked quality gate for every push and pull request", async () => {
    const workflow = asRecord(parse(await readFile(workflowPath, "utf8")), "workflow");
    const permissions = asRecord(workflow.permissions, "permissions");
    expect(permissions).toEqual({ contents: "read" });

    const triggers = asRecord(workflow.on, "on");
    expect(Object.hasOwn(triggers, "push")).toBe(true);
    expect(Object.hasOwn(triggers, "pull_request")).toBe(true);

    for (const eventName of ["push", "pull_request"] as const) {
      const event = triggers[eventName];
      if (event !== null) {
        const filters = asRecord(event, `${eventName} trigger`);
        expect(filters).not.toHaveProperty("paths");
        expect(filters).not.toHaveProperty("paths-ignore");
        expect(filters).not.toHaveProperty("branches");
        expect(filters).not.toHaveProperty("branches-ignore");
      }
    }

    const defaults = asRecord(workflow.defaults, "defaults");
    const defaultRun = asRecord(defaults.run, "defaults.run");
    expect(defaultRun["working-directory"]).toBe("frontend");

    const jobs = asRecord(workflow.jobs, "jobs");
    const quality = asRecord(jobs.quality, "quality job");
    expect(quality["runs-on"]).toBe("ubuntu-24.04");

    const steps = asArray(quality.steps, "quality steps").map((step, index) =>
      asRecord(step, `quality step ${index + 1}`),
    );
    const checkoutIndex = steps.findIndex(
      (step) => step.uses === "actions/checkout@v4",
    );
    const setupNodeIndex = steps.findIndex(
      (step) => step.uses === "actions/setup-node@v4",
    );

    expect(checkoutIndex).toBeGreaterThanOrEqual(0);
    expect(setupNodeIndex).toBeGreaterThan(checkoutIndex);
    expect(asRecord(steps[checkoutIndex]?.with, "checkout.with")).toMatchObject({
      "persist-credentials": false,
    });
    expect(asRecord(steps[setupNodeIndex]?.with, "setup-node.with")).toMatchObject({
      "node-version-file": ".node-version",
      cache: "npm",
      "cache-dependency-path": "frontend/package-lock.json",
    });

    const commands = steps
      .map((step) => step.run)
      .filter((command): command is string => typeof command === "string");
    expect(commands).toEqual([
      "npm ci",
      "npx playwright install --with-deps chromium",
      "npm run check",
    ]);
    expect(commands.join("\n")).not.toMatch(/ci-contract|--exclude|--filter/iu);
  });
});

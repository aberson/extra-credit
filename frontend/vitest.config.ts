import { availableParallelism } from "node:os";

import { defineConfig } from "vitest/config";

// Several suites are legitimately slow rather than stuck: the Two Whats and a
// Wow candidate-capacity enumeration over O=20 R=20, the fixed-seed-range
// property tests, and the integration tests that boot a real Fastify server on
// an ephemeral socket. The slowest measured honest run is about ten seconds, so
// the ceiling is set at three times that. It is wide enough that a correct test
// is never failed for losing a scheduling race on a busy machine, and still
// tight enough that a genuinely hung test reports in half a minute rather than
// stalling the gate for minutes.
const SLOW_BUT_CORRECT_CEILING_MS = 30_000;

// Vitest otherwise runs one worker per CPU. Each worker is a full Node fork
// with its own compiler, GC threads and (for the React suites) jsdom, so a
// worker-per-CPU run oversubscribes the box and the slow tests above lose the
// scheduling race and blow their timeout - a different subset each run. Half of
// the reported parallelism keeps real file-level concurrency while leaving
// headroom for everything a worker needs beyond its own core. The floor of two
// keeps small CI runners parallel: this is a formula rather than a constant so
// that a 22-CPU workstation (11 workers) and a 2-4 vCPU GitHub Actions runner
// (2 workers) are both served. availableParallelism, unlike cpus().length,
// reports the parallelism actually available under CPU affinity and container
// quotas, which is what a hosted runner exposes.
const MAX_WORKERS = Math.max(2, Math.floor(availableParallelism() / 2));

export default defineConfig({
  test: {
    environment: "node",
    include: [
      "src/**/*.test.{ts,tsx}",
      "tests/integration/**/*.test.{ts,tsx}",
    ],
    exclude: ["tests/e2e/**", "dist/**", "node_modules/**"],
    passWithNoTests: false,
    restoreMocks: true,
    testTimeout: SLOW_BUT_CORRECT_CEILING_MS,
    hookTimeout: SLOW_BUT_CORRECT_CEILING_MS,
    maxWorkers: MAX_WORKERS,
  },
});

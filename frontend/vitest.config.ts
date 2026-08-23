import { defineConfig } from "vitest/config";

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
  },
});

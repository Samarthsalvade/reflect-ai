import { defineConfig } from "vitest/config";

// Runs against a real Supabase project. Needs .env.local plus the TEST_* variables
// described in README.md. The suite skips itself when they are missing.
export default defineConfig({
  resolve: { alias: { "@": import.meta.dirname } },
  test: {
    include: ["tests/integration/**/*.test.ts"],
    environment: "node",
    testTimeout: 60_000,
    fileParallelism: false,
  },
});
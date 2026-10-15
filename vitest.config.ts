import { defineConfig } from "vitest/config";

export default defineConfig({
  // The Ink tests wait a fixed moment for each render, which a busy machine sometimes misses.
  test: { env: { FORCE_COLOR: "3" }, retry: 2, setupFiles: ["test/setup.ts"] },
});

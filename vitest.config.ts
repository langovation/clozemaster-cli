import os from "node:os";
import path from "node:path";
import { defineConfig } from "vitest/config";

export default defineConfig({
  // A throwaway config dir so tests never touch the real saved login or settings.
  test: { env: { FORCE_COLOR: "3", XDG_CONFIG_HOME: path.join(os.tmpdir(), `clozemaster-cli-test-${process.pid}`) } },
});

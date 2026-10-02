import { defineConfig } from "tsup";

export default defineConfig({
  banner: { js: "#!/usr/bin/env node" },
  clean: true,
  entry: { cli: "src/cli.tsx" },
  format: ["esm"],
  target: "node20",
});

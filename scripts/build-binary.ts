// Ink only loads react-devtools-core in DEV mode, but Bun still bundles the import, so stub it out.
const stubDevtools: Bun.BunPlugin = {
  name: "stub-react-devtools-core",
  setup(build) {
    build.onResolve({ filter: /^react-devtools-core$/ }, () => ({ path: "react-devtools-core", namespace: "stub" }));
    build.onLoad({ filter: /.*/, namespace: "stub" }, () => ({ contents: "export default {};", loader: "js" }));
  },
};

const targets = process.argv.includes("--all")
  ? ["darwin-arm64", "darwin-x64", "linux-x64", "linux-arm64"]
  : [`${process.platform}-${process.arch}`];

for (const target of targets) {
  const result = await Bun.build({
    entrypoints: ["src/cli.tsx"],
    compile: { target: `bun-${target}` as Bun.Build.Target, outfile: `bin/clozemaster-${target}` },
    minify: true,
    plugins: [stubDevtools],
  });
  if (!result.success) {
    for (const log of result.logs) console.error(log);
    process.exit(1);
  }
  console.log(`Built bin/clozemaster-${target}`);
}

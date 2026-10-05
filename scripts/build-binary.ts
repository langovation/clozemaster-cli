// Ink only loads react-devtools-core in DEV mode, but Bun still bundles the import, so stub it out.
const result = await Bun.build({
  entrypoints: ["src/cli.tsx"],
  compile: { outfile: "bin/clozemaster" },
  minify: true,
  plugins: [
    {
      name: "stub-react-devtools-core",
      setup(build) {
        build.onResolve({ filter: /^react-devtools-core$/ }, () => ({ path: "react-devtools-core", namespace: "stub" }));
        build.onLoad({ filter: /.*/, namespace: "stub" }, () => ({ contents: "export default {};", loader: "js" }));
      },
    },
  ],
});

if (!result.success) {
  for (const log of result.logs) console.error(log);
  process.exit(1);
}

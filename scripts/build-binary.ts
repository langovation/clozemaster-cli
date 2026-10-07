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

// The default linux-x64 build needs AVX2 and crashes with "Illegal instruction" on older CPUs.
const bunTarget = (target: string) => (target === "linux-x64" ? "bun-linux-x64-baseline" : `bun-${target}`);

for (const target of targets) {
  const result = await Bun.build({
    entrypoints: ["src/cli.tsx"],
    compile: { target: bunTarget(target) as Bun.Build.Target, outfile: `bin/clozemaster-${target}` },
    minify: true,
    plugins: [stubDevtools],
  });
  if (!result.success) {
    for (const log of result.logs) console.error(log);
    process.exit(1);
  }
  console.log(`Built bin/clozemaster-${target}`);
}

// The installer refuses to install unless the release has this file and the download matches it.
const checksumLines = await Promise.all(
  targets.map(async (target) => {
    const file = `clozemaster-${target}`;
    const bytes = await Bun.file(`bin/${file}`).arrayBuffer();
    return `${new Bun.CryptoHasher("sha256").update(bytes).digest("hex")}  ${file}`;
  }),
);
await Bun.write("bin/SHA256SUMS", `${checksumLines.join("\n")}\n`);
console.log("Wrote bin/SHA256SUMS");

export type Checksum = { file: string; sha256: string };

export function mergeChecksums(existingFile: string, built: Checksum[]): string {
  const checksums = new Map(parseChecksums(existingFile).map((checksum) => [checksum.file, checksum.sha256]));
  built.forEach(({ file, sha256 }) => checksums.set(file, sha256));
  const lines = [...checksums.keys()].sort().map((file) => `${checksums.get(file)}  ${file}`);
  return `${lines.join("\n")}\n`;
}

function parseChecksums(file: string): Checksum[] {
  return file
    .split("\n")
    .map((line) => line.match(/^([0-9a-f]{64}) {2}(\S+)$/))
    .filter((match) => match !== null)
    .map(([, sha256, name]) => ({ file: name, sha256 }));
}

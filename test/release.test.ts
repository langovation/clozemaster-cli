import path from "node:path";
import { describe, expect, it, vi } from "vitest";

const releaseScript = path.join(__dirname, "..", "scripts", "release.sh");

async function runRelease(version: string) {
  const { spawnSync } = await vi.importActual<typeof import("node:child_process")>("node:child_process");
  return spawnSync("sh", [releaseScript, version], { encoding: "utf8" });
}

describe("release.sh", () => {
  it("is valid sh", async () => {
    const { execFileSync } = await vi.importActual<typeof import("node:child_process")>("node:child_process");
    expect(() => execFileSync("sh", ["-n", releaseScript])).not.toThrow();
  });

  it("refuses a version that isn't major.minor.patch before touching git", async () => {
    const release = await runRelease("v0.2");
    expect(release.status).toBe(1);
    expect(release.stderr).toContain("Usage: npm run release -- <version>");
  });
});

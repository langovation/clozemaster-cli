import fs from "node:fs";
import path from "node:path";
import { describe, expect, it, vi } from "vitest";

const installScript = path.join(__dirname, "..", "install.sh");

describe("install.sh", () => {
  it("is valid sh", async () => {
    const { execFileSync } = await vi.importActual<typeof import("node:child_process")>("node:child_process");
    expect(() => execFileSync("sh", ["-n", installScript])).not.toThrow();
  });

  it("downloads only over HTTPS with TLS 1.2 or newer, retrying failures", () => {
    const downloads = fs.readFileSync(installScript, "utf8").split("\n").filter((line) => /^\s*curl /.test(line));
    expect(downloads).toHaveLength(1);
    expect(downloads[0]).toContain("curl --proto '=https' --tlsv1.2 -fsSL --retry 3 ");
  });
});

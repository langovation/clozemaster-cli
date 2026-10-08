import packageJson from "../package.json" with { type: "json" };
import { baseUrl } from "./config.js";

export const currentVersion = packageJson.version;
export const updateCommand = "curl -fsSL https://www.clozemaster.com/install-cli.sh | sh";

const VERSION_PART_COUNT = 3;

export function isNewerVersion(candidate: string, current: string): boolean {
  const candidateParts = versionParts(candidate);
  const currentParts = versionParts(current);
  for (let index = 0; index < VERSION_PART_COUNT; index++) {
    const difference = (candidateParts[index] ?? 0) - (currentParts[index] ?? 0);
    if (difference !== 0) return difference > 0;
  }
  return false;
}

function versionParts(version: string): number[] {
  return version.split(".").map(Number);
}

export async function fetchNewerVersion(): Promise<string | undefined> {
  try {
    const response = await fetch(`${baseUrl}/cli-version.txt`);
    if (!response.ok) return undefined;
    const latestVersion = (await response.text()).trim();
    return isNewerVersion(latestVersion, currentVersion) ? latestVersion : undefined;
  } catch {
    return undefined;
  }
}

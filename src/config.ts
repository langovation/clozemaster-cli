import fs from "node:fs";
import os from "node:os";
import path from "node:path";

export type StoredLogin = { authToken: string; username: string };

export const baseUrl = (process.env.CLOZEMASTER_URL || "https://www.clozemaster.com").replace(/\/$/, "");

export const configDirectory = path.join(process.env.XDG_CONFIG_HOME || path.join(os.homedir(), ".config"), "clozemaster");
const loginsPath = path.join(configDirectory, "logins.json");

// Keyed by base URL so a localhost login never gets sent to production.
function readLogins(): Record<string, StoredLogin> {
  try {
    return JSON.parse(fs.readFileSync(loginsPath, "utf8"));
  } catch {
    return {};
  }
}

function writeLogins(logins: Record<string, StoredLogin>) {
  fs.mkdirSync(configDirectory, { recursive: true });
  fs.writeFileSync(loginsPath, JSON.stringify(logins, null, 2), { mode: 0o600 });
}

export function getAuthToken(): string | undefined {
  return process.env.CLOZEMASTER_TOKEN || readLogins()[baseUrl]?.authToken;
}

export function isUsingSavedLogin(): boolean {
  return !process.env.CLOZEMASTER_TOKEN && Boolean(readLogins()[baseUrl]?.authToken);
}

export function hasLogin(): boolean {
  return Boolean(getAuthToken() || process.env.CLOZEMASTER_COOKIE);
}

export function getStoredUsername(): string | undefined {
  return readLogins()[baseUrl]?.username;
}

export function saveLogin(login: StoredLogin) {
  writeLogins({ ...readLogins(), [baseUrl]: login });
}

export function clearLogin() {
  const { [baseUrl]: _removed, ...rest } = readLogins();
  writeLogins(rest);
}

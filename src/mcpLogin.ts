import open from "open";
import { pollCliLogin, startCliLogin, type CliLoginStart } from "./api.js";
import { saveLogin } from "./config.js";

type PendingLogin = { expiresAt: number; login: CliLoginStart };

let pendingLogin: PendingLogin | undefined;

// Polls in the background, so the tool call after approval finds the saved login.
export async function startBrowserLogin(): Promise<string> {
  const login = currentLogin() || (await beginLogin());
  return `Not logged in to Clozemaster yet. A browser window opened to log in, showing the code ${login.userCode} (if it didn't open, visit ${login.verificationUrl}). Ask the user to log in and approve it there, then call this tool again.`;
}

function currentLogin(): CliLoginStart | undefined {
  return pendingLogin && Date.now() < pendingLogin.expiresAt ? pendingLogin.login : undefined;
}

async function beginLogin(): Promise<CliLoginStart> {
  const login = await startCliLogin();
  pendingLogin = { expiresAt: Date.now() + login.expiresIn * 1000, login };
  await open(login.verificationUrl).catch(() => undefined);
  waitForApproval(login);
  return login;
}

async function waitForApproval(login: CliLoginStart) {
  while (currentLogin() === login) {
    await new Promise((resolve) => setTimeout(resolve, login.pollInterval * 1000));
    try {
      const approvedLogin = await pollCliLogin(login.deviceCode);
      if (!approvedLogin) continue;
      saveLogin(approvedLogin);
      pendingLogin = undefined;
    } catch {
      pendingLogin = undefined;
    }
  }
}

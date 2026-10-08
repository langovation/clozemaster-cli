import open from "open";
import { pollCliLogin, startCliLogin, type CliLoginStart } from "./api.js";
import { saveLogin } from "./config.js";

type PendingLogin = { expiresAt: number; login: CliLoginStart };

let pendingLogin: PendingLogin | undefined;

// Polls in the background, so the tool call after approval finds the saved login.
export async function startOrResumeBrowserLogin(): Promise<CliLoginStart> {
  return unexpiredPendingLogin() || (await startBrowserLogin());
}

function unexpiredPendingLogin(): CliLoginStart | undefined {
  return pendingLogin && Date.now() < pendingLogin.expiresAt ? pendingLogin.login : undefined;
}

async function startBrowserLogin(): Promise<CliLoginStart> {
  const login = await startCliLogin();
  pendingLogin = { expiresAt: Date.now() + login.expiresIn * 1000, login };
  await open(login.verificationUrl).catch(() => undefined);
  pollUntilApproved(login);
  return login;
}

async function pollUntilApproved(login: CliLoginStart) {
  while (unexpiredPendingLogin() === login) {
    await new Promise((resolve) => setTimeout(resolve, login.pollInterval * 1000));
    try {
      const approvedLogin = await pollCliLogin(login.deviceCode);
      if (!approvedLogin) continue;
      saveLogin(approvedLogin);
    } catch {}
    pendingLogin = undefined;
  }
}

import React, { useEffect, useState } from "react";
import { Box, Text, useInput } from "ink";
import open from "open";
import { isApiError, pollCliLogin, startCliLogin, type CliLoginStart } from "../api.js";
import { saveLogin } from "../config.js";
import { Hints } from "../components/Hints.js";
import { Spinner } from "../components/Spinner.js";
import { Welcome } from "../components/Welcome.js";
import { colors } from "../theme.js";

type LoginState =
  | { step: "ready" }
  | { step: "starting" }
  | { login: CliLoginStart; step: "waiting" }
  | { message: string; step: "failed" };

export function Login({ onLoggedIn }: { onLoggedIn: (username: string) => void }) {
  const [state, setState] = useState<LoginState>({ step: "ready" });

  useInput((_input, key) => {
    if (key.return && (state.step === "ready" || state.step === "failed")) startLogin();
  });

  async function startLogin() {
    setState({ step: "starting" });
    try {
      const login = await startCliLogin();
      setState({ login, step: "waiting" });
      await open(login.verificationUrl).catch(() => undefined);
    } catch (error) {
      setState({ message: loginErrorMessage(error), step: "failed" });
    }
  }

  useEffect(() => {
    if (state.step !== "waiting") return;
    const { login } = state;
    const timer = setInterval(pollForApproval, login.pollInterval * 1000);

    async function pollForApproval() {
      try {
        const approvedLogin = await pollCliLogin(login.deviceCode);
        if (!approvedLogin) return;
        clearInterval(timer);
        saveLogin(approvedLogin);
        onLoggedIn(approvedLogin.username);
      } catch (error) {
        clearInterval(timer);
        setState({ message: loginErrorMessage(error), step: "failed" });
      }
    }

    return () => clearInterval(timer);
  }, [state]);

  return (
    <Box flexDirection="column" gap={1}>
      <Welcome subtitle="Learn a language in context, one missing word at a time." />
      {state.step === "ready" && <Text>Press <Text color={colors.brand} bold>Enter</Text> to open the browser and log in.</Text>}
      {state.step === "starting" && <Spinner label="Starting login…" />}
      {state.step === "waiting" && <WaitingForApproval login={state.login} />}
      {state.step === "failed" && <LoginFailed message={state.message} />}
      <Hints hints={["ctrl+c to quit"]} />
    </Box>
  );
}

function WaitingForApproval({ login }: { login: CliLoginStart }) {
  return (
    <Box flexDirection="column">
      <Text>Your code: <Text color={colors.brand} bold>{login.userCode}</Text></Text>
      <Text dimColor>Browser didn't open? Visit {login.verificationUrl}</Text>
      <Box marginTop={1}>
        <Spinner label="Waiting for you to log in in the browser…" />
      </Box>
    </Box>
  );
}

function LoginFailed({ message }: { message: string }) {
  return (
    <Box flexDirection="column">
      <Text color={colors.danger}>{message}</Text>
      <Text>Press <Text bold>Enter</Text> to try again.</Text>
    </Box>
  );
}

function loginErrorMessage(error: unknown): string {
  if (isApiError(error, 410)) return "That login code expired.";
  if (isApiError(error, 404)) return "Browser login isn't available on this server yet. Set CLOZEMASTER_TOKEN instead.";
  return `Couldn't log in: ${error instanceof Error ? error.message : String(error)}`;
}

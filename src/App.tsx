import React, { useState } from "react";
import { Box, useStdout } from "ink";
import type { LanguagePairing, PlayMode } from "./api.js";
import { getAuthToken, getStoredUsername } from "./config.js";
import { BrowseCollections } from "./screens/BrowseCollections.js";
import { Login } from "./screens/Login.js";
import { SettingsScreen } from "./screens/SettingsScreen.js";
import { SettingsProvider } from "./SettingsContext.js";
import { PickLanguagePairing } from "./screens/PickLanguagePairing.js";
import { nextMode, PickMode } from "./screens/PickMode.js";
import { PickRound, type RoundChoice } from "./screens/PickRound.js";
import { Play } from "./screens/Play.js";

const MAX_WIDTH = 80;

export function App({ forceLogin = false }: { forceLogin?: boolean }) {
  const { stdout } = useStdout();
  return (
    <Box flexDirection="column" paddingY={1} width={Math.min(stdout.columns || MAX_WIDTH, MAX_WIDTH)}>
      <SettingsProvider>
        <Screens forceLogin={forceLogin} />
      </SettingsProvider>
    </Box>
  );
}

function Screens({ forceLogin }: { forceLogin: boolean }) {
  const [isLoggedIn, setIsLoggedIn] = useState(!forceLogin && Boolean(getAuthToken() || process.env.CLOZEMASTER_COOKIE));
  const [username, setUsername] = useState(getStoredUsername());
  const [pairing, setPairing] = useState<LanguagePairing>();
  const [choice, setChoice] = useState<RoundChoice>();
  const [mode, setMode] = useState<PlayMode>();
  const [isBrowsing, setIsBrowsing] = useState(false);
  const [isShowingSettings, setIsShowingSettings] = useState(false);

  const toggleMode = () => setMode((current) => current && nextMode(current));

  if (!isLoggedIn) {
    return (
      <Login
        onLoggedIn={(loggedInUsername) => {
          setUsername(loggedInUsername);
          setIsLoggedIn(true);
        }}
      />
    );
  }
  if (isShowingSettings) return <SettingsScreen onBack={() => setIsShowingSettings(false)} />;
  const openSettings = () => setIsShowingSettings(true);
  if (!pairing) return <PickLanguagePairing onOpenSettings={openSettings} onPick={setPairing} username={username} />;
  if (!choice && isBrowsing) {
    return <BrowseCollections onBack={() => setIsBrowsing(false)} onPick={setChoice} pairing={pairing} />;
  }
  if (!choice) {
    return (
      <PickRound
        onBack={() => setPairing(undefined)}
        onBrowse={() => setIsBrowsing(true)}
        onOpenSettings={openSettings}
        onPick={setChoice}
        pairing={pairing}
      />
    );
  }
  if (!mode) return <PickMode onBack={() => setChoice(undefined)} onPick={setMode} title={choice.title} />;
  return (
    <Play
      choice={choice}
      mode={mode}
      onMenu={() => {
        setIsBrowsing(false);
        setChoice(undefined);
        setMode(undefined);
      }}
      onToggleMode={toggleMode}
    />
  );
}

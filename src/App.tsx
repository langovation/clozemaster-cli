import React, { useState } from "react";
import { Box, useStdout } from "ink";
import type { LanguagePairing, LanguagePairingProgress, PlayMode } from "./api.js";
import { UpdateNotice } from "./components/UpdateNotice.js";
import { getStoredUsername, hasLogin } from "./config.js";
import { nextMode } from "./playModes.js";
import type { RoundChoice } from "./roundChoice.js";
import { BrowseCollections } from "./screens/BrowseCollections.js";
import { Login } from "./screens/Login.js";
import { PickLanguagePairing } from "./screens/PickLanguagePairing.js";
import { PickMode } from "./screens/PickMode.js";
import { PickRound } from "./screens/PickRound.js";
import { Play } from "./screens/Play.js";
import { QuickCapture } from "./screens/QuickCapture.js";
import { SettingsScreen } from "./screens/SettingsScreen.js";
import { SettingsProvider } from "./SettingsContext.js";

const MAX_WIDTH = 80;

export function App({ forceLogin = false }: { forceLogin?: boolean }) {
  const { stdout } = useStdout();
  return (
    <Box flexDirection="column" paddingY={1} width={Math.min(stdout.columns || MAX_WIDTH, MAX_WIDTH)}>
      <UpdateNotice />
      <SettingsProvider>
        <Screens forceLogin={forceLogin} />
      </SettingsProvider>
    </Box>
  );
}

function Screens({ forceLogin }: { forceLogin: boolean }) {
  const [isLoggedIn, setIsLoggedIn] = useState(!forceLogin && hasLogin());
  const [username, setUsername] = useState(getStoredUsername());

  function finishLogin(loggedInUsername: string) {
    setUsername(loggedInUsername);
    setIsLoggedIn(true);
  }

  if (!isLoggedIn) return <Login onLoggedIn={finishLogin} />;
  return <Menu username={username} />;
}

function Menu({ username }: { username?: string }) {
  const [pairing, setPairing] = useState<LanguagePairing>();
  const [isShowingSettings, setIsShowingSettings] = useState(false);
  const openSettings = () => setIsShowingSettings(true);

  function updatePairingProgress(progress: LanguagePairingProgress) {
    setPairing((current) => current && { ...current, ...progress });
  }

  if (isShowingSettings) return <SettingsScreen onBack={() => setIsShowingSettings(false)} />;
  if (!pairing) return <PickLanguagePairing onOpenSettings={openSettings} onPick={setPairing} username={username} />;
  return <PairingScreens onBack={() => setPairing(undefined)} onOpenSettings={openSettings} onProgress={updatePairingProgress} pairing={pairing} />;
}

type PairingScreensProps = {
  onBack: () => void;
  onOpenSettings: () => void;
  onProgress: (progress: LanguagePairingProgress) => void;
  pairing: LanguagePairing;
};

function PairingScreens({ onBack, onOpenSettings, onProgress, pairing }: PairingScreensProps) {
  const [choice, setChoice] = useState<RoundChoice>();
  const [mode, setMode] = useState<PlayMode>();
  const [isBrowsing, setIsBrowsing] = useState(false);
  const [isCapturing, setIsCapturing] = useState(false);

  function backToRoundMenu() {
    setIsBrowsing(false);
    setChoice(undefined);
    setMode(undefined);
  }

  if (choice && mode) {
    return (
      <Play
        choice={choice}
        mode={mode}
        onMenu={backToRoundMenu}
        onProgress={onProgress}
        onToggleMode={() => setMode((current) => current && nextMode(current))}
      />
    );
  }
  if (choice) return <PickMode onBack={() => setChoice(undefined)} onPick={setMode} title={choice.title} />;
  if (isCapturing) return <QuickCapture onBack={() => setIsCapturing(false)} pairing={pairing} />;
  if (isBrowsing) return <BrowseCollections onBack={() => setIsBrowsing(false)} onPick={setChoice} pairing={pairing} />;
  return (
    <PickRound
      onBack={onBack}
      onBrowse={() => setIsBrowsing(true)}
      onOpenQuickCapture={() => setIsCapturing(true)}
      onOpenSettings={onOpenSettings}
      onPick={setChoice}
      pairing={pairing}
    />
  );
}

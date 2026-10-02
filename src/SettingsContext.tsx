import React, { createContext, useContext, useState, type ReactNode } from "react";
import { loadSettings, saveSettings, type Settings } from "./settings.js";

type SettingsContextValue = { settings: Settings; updateSettings: (changes: Partial<Settings>) => void };

const SettingsContext = createContext<SettingsContextValue | undefined>(undefined);

export function SettingsProvider({ children }: { children: ReactNode }) {
  const [settings, setSettings] = useState(loadSettings);
  const updateSettings = (changes: Partial<Settings>) => {
    const updated = { ...settings, ...changes };
    setSettings(updated);
    saveSettings(updated);
  };
  return <SettingsContext.Provider value={{ settings, updateSettings }}>{children}</SettingsContext.Provider>;
}

export function useSettings(): SettingsContextValue {
  const value = useContext(SettingsContext);
  if (!value) throw new Error("useSettings must be used inside SettingsProvider");
  return value;
}

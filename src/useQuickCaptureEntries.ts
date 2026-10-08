import { useEffect, useRef, useState } from "react";
import {
  addQuickCaptureEntry,
  deleteQuickCaptureEntry,
  getQuickCaptureEntries,
  type LanguagePairing,
  type QuickCaptureEntry,
} from "./api.js";

const POLL_INTERVAL_MS = 3000;

export function useQuickCaptureEntries(pairing: LanguagePairing) {
  const [entries, setEntries] = useState<QuickCaptureEntry[]>();
  const [error, setError] = useState<Error>();
  const changeCount = useRef(0);
  const isTranslating = entries?.some((entry) => !isSettled(entry));

  useEffect(() => {
    loadEntries();
  }, [pairing.id]);

  useEffect(() => {
    if (!isTranslating) return;
    const timer = setTimeout(loadEntries, POLL_INTERVAL_MS);
    return () => clearTimeout(timer);
  }, [entries]);

  // A load that started before an add or delete would bring back the old list, so it's dropped.
  async function loadEntries() {
    const changeCountAtStart = changeCount.current;
    try {
      const loaded = await getQuickCaptureEntries(pairing);
      if (changeCountAtStart === changeCount.current) setEntries(loaded);
    } catch (loadError) {
      setError(loadError as Error);
    }
  }

  async function addEntry(text: string) {
    changeCount.current++;
    try {
      const entry = await addQuickCaptureEntry(pairing, text);
      setEntries((current = []) => [entry, ...current.filter((existing) => existing.id !== entry.id)]);
      setError(undefined);
    } catch (addError) {
      setError(addError as Error);
    }
  }

  async function deleteEntry(entry: QuickCaptureEntry) {
    changeCount.current++;
    setEntries((current = []) => current.filter((existing) => existing.id !== entry.id));
    try {
      await deleteQuickCaptureEntry(entry);
    } catch (deleteError) {
      setError(deleteError as Error);
    }
  }

  function replaceEntry(saved: QuickCaptureEntry) {
    changeCount.current++;
    setEntries((current = []) => current.map((entry) => (entry.id === saved.id ? saved : entry)));
  }

  return { addEntry, deleteEntry, entries, error, replaceEntry, showEntries: setEntries };
}

function isSettled(entry: QuickCaptureEntry): boolean {
  return entry.status === "processed" || entry.status === "failed";
}

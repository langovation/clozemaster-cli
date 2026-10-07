import React, { useEffect, useState } from "react";
import { Box, Text, useInput } from "ink";
import TextInput from "ink-text-input";
import {
  addQuickCaptureEntry,
  deleteQuickCaptureEntry,
  getQuickCaptureEntries,
  type LanguagePairing,
  type QuickCaptureEntry,
} from "../api.js";
import { ErrorMessage } from "../components/ErrorMessage.js";
import { Hints } from "../components/Hints.js";
import { Spinner } from "../components/Spinner.js";
import { colors } from "../theme.js";

const POLL_INTERVAL_MS = 3000;

const isSettled = (entry: QuickCaptureEntry) => entry.status === "processed" || entry.status === "failed";

function entryDetail(entry: QuickCaptureEntry): string {
  if (entry.status === "failed") return "failed";
  if (entry.status === "processed") return entry.translation || "";
  return "translating…";
}

type QuickCaptureProps = { onBack: () => void; pairing: LanguagePairing };

export function QuickCapture({ onBack, pairing }: QuickCaptureProps) {
  const [entries, setEntries] = useState<QuickCaptureEntry[]>();
  const [error, setError] = useState<Error>();
  const [text, setText] = useState("");
  const [isListFocused, setIsListFocused] = useState(false);
  const [highlighted, setHighlighted] = useState(0);

  async function loadEntries() {
    try {
      setEntries(await getQuickCaptureEntries(pairing));
    } catch (loadError) {
      setError(loadError as Error);
    }
  }

  useEffect(() => {
    loadEntries();
  }, [pairing.id]);

  const isTranslating = entries?.some((entry) => !isSettled(entry));
  useEffect(() => {
    if (!isTranslating) return;
    const timer = setTimeout(loadEntries, POLL_INTERVAL_MS);
    return () => clearTimeout(timer);
  }, [entries]);

  async function addEntry(submitted: string) {
    const trimmed = submitted.trim();
    if (!trimmed) return;
    setText("");
    try {
      const entry = await addQuickCaptureEntry(pairing, trimmed);
      setEntries((current = []) => [entry, ...current.filter((existing) => existing.id !== entry.id)]);
      setError(undefined);
    } catch (addError) {
      setError(addError as Error);
    }
  }

  async function deleteHighlightedEntry(list: QuickCaptureEntry[]) {
    const entry = list[highlighted];
    const remaining = list.filter((existing) => existing.id !== entry.id);
    setEntries(remaining);
    setHighlighted(Math.min(highlighted, remaining.length - 1));
    if (remaining.length === 0) setIsListFocused(false);
    try {
      await deleteQuickCaptureEntry(entry);
    } catch (deleteError) {
      setError(deleteError as Error);
    }
  }

  useInput((input, key) => {
    if (key.escape) return onBack();
    if (key.tab) return setIsListFocused((isFocused) => !isFocused && Boolean(entries?.length));
    if (!isListFocused || !entries?.length) return;
    if (key.upArrow) setHighlighted((index) => (index - 1 + entries.length) % entries.length);
    if (key.downArrow) setHighlighted((index) => (index + 1) % entries.length);
    if (input === "d") deleteHighlightedEntry(entries);
  });

  return (
    <Box flexDirection="column" gap={1}>
      <Box flexDirection="column">
        <Text bold>Quick Capture · {pairing.targetLanguageName}</Text>
        <Text dimColor>Save words you come across, then add them to a collection in the Clozemaster app.</Text>
      </Box>
      <Box>
        <Text color={colors.brand}>❯ </Text>
        <TextInput focus={!isListFocused} onChange={setText} onSubmit={addEntry} placeholder="type a word or phrase" value={text} />
      </Box>
      {error && <ErrorMessage error={error} />}
      {!entries && !error && <Spinner label="Loading your words…" />}
      {entries?.length === 0 && <Text dimColor>Nothing captured yet.</Text>}
      {entries && entries.length > 0 && (
        <Box flexDirection="column">
          {entries.map((entry, index) => {
            const isHighlighted = isListFocused && index === highlighted;
            return (
              <Box key={entry.id} justifyContent="space-between" gap={2}>
                <Text color={isHighlighted ? colors.brand : undefined} wrap="truncate-end">
                  {isHighlighted ? "❯ " : "  "}
                  {entry.text}
                </Text>
                <Box flexShrink={0}>
                  <Text color={entry.status === "failed" ? colors.danger : undefined} dimColor={entry.status !== "failed"}>
                    {entryDetail(entry)}
                  </Text>
                </Box>
              </Box>
            );
          })}
        </Box>
      )}
      <Hints hints={isListFocused ? ["↑↓ to move", "d delete", "tab to type", "esc back"] : ["enter to save", "tab to pick a word", "esc back"]} />
    </Box>
  );
}

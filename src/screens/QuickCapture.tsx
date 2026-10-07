import React, { useEffect, useRef, useState } from "react";
import { Box, Text, useInput } from "ink";
import TextInput from "ink-text-input";
import {
  addQuickCaptureEntry,
  deleteQuickCaptureEntry,
  getQuickCaptureEntries,
  type LanguagePairing,
  type OwnCollection,
  type QuickCaptureEntry,
} from "../api.js";
import { ErrorMessage } from "../components/ErrorMessage.js";
import { Hints } from "../components/Hints.js";
import { Spinner } from "../components/Spinner.js";
import { colors } from "../theme.js";
import { ClozeSentence, EditQuickCaptureEntry } from "./EditQuickCaptureEntry.js";
import { ImportQuickCapture } from "./ImportQuickCapture.js";

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
  const [selectedIds, setSelectedIds] = useState(new Set<string>());
  const [entriesToImport, setEntriesToImport] = useState<QuickCaptureEntry[]>();
  const [importNotice, setImportNotice] = useState<string>();
  const [editedEntry, setEditedEntry] = useState<QuickCaptureEntry>();
  const changeCount = useRef(0);

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
    changeCount.current++;
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
    changeCount.current++;
    setEntries(remaining);
    setHighlighted(Math.max(0, Math.min(highlighted, remaining.length - 1)));
    if (remaining.length === 0) setIsListFocused(false);
    try {
      await deleteQuickCaptureEntry(entry);
    } catch (deleteError) {
      setError(deleteError as Error);
    }
  }

  function toggleSelected(entry: QuickCaptureEntry) {
    setSelectedIds((current) => {
      const next = new Set(current);
      if (!next.delete(entry.id)) next.add(entry.id);
      return next;
    });
  }

  // Imports the ticked words, or the highlighted one when none are ticked.
  function startImport(list: QuickCaptureEntry[]) {
    const selected = list.filter((entry) => selectedIds.has(entry.id));
    setEntriesToImport(selected.length ? selected : [list[highlighted]]);
  }

  function finishImport(collection: OwnCollection) {
    const importedIds = new Set(entriesToImport!.map((entry) => entry.id));
    const remaining = (entries || []).filter((entry) => !importedIds.has(entry.id));
    setEntries(remaining);
    setSelectedIds(new Set());
    setHighlighted(0);
    setIsListFocused(remaining.length > 0);
    setImportNotice(`Importing ${importedIds.size} into ${collection.name}. They'll show up there in a minute.`);
    setEntriesToImport(undefined);
  }

  function finishEditing(saved: QuickCaptureEntry) {
    changeCount.current++;
    setEntries((current = []) => current.map((entry) => (entry.id === saved.id ? saved : entry)));
    setEditedEntry(undefined);
  }

  useInput((input, key) => {
    if (key.escape) return onBack();
    if (key.tab) return setIsListFocused((isFocused) => !isFocused && Boolean(entries?.length));
    if (!isListFocused || !entries?.length) return;
    if (key.upArrow) setHighlighted((index) => (index - 1 + entries.length) % entries.length);
    if (key.downArrow) setHighlighted((index) => (index + 1) % entries.length);
    if (input === "d") deleteHighlightedEntry(entries);
    if (input === " ") toggleSelected(entries[highlighted]);
    if (input === "i") startImport(entries);
    if (key.return) setEditedEntry(entries[highlighted]);
  }, { isActive: !entriesToImport && !editedEntry });

  if (editedEntry) return <EditQuickCaptureEntry entry={editedEntry} onBack={() => setEditedEntry(undefined)} onSaved={finishEditing} />;

  if (entriesToImport) {
    return <ImportQuickCapture entries={entriesToImport} onBack={() => setEntriesToImport(undefined)} onImported={finishImport} pairing={pairing} />;
  }

  return (
    <Box flexDirection="column" gap={1}>
      <Box flexDirection="column">
        <Text bold>Quick Capture · {pairing.targetLanguageName}</Text>
        <Text dimColor>Save words you come across, then import them into a collection to play.</Text>
      </Box>
      <Box>
        <Text color={colors.brand}>❯ </Text>
        <TextInput focus={!isListFocused} onChange={setText} onSubmit={addEntry} placeholder="type a word or phrase" value={text} />
      </Box>
      {error && <ErrorMessage error={error} />}
      {importNotice && <Text color={colors.brand}>{importNotice}</Text>}
      {!entries && !error && <Spinner label="Loading your words…" />}
      {entries?.length === 0 && <Text dimColor>Nothing captured yet.</Text>}
      {entries && entries.length > 0 && (
        <Box flexDirection="column">
          {entries.map((entry, index) => {
            const isHighlighted = isListFocused && index === highlighted;
            return (
              <Box key={entry.id} flexDirection="column">
                <Box justifyContent="space-between" gap={2}>
                  <Text color={isHighlighted ? colors.brand : undefined} wrap="truncate-end">
                    {isHighlighted ? "❯ " : "  "}
                    {selectedIds.has(entry.id) ? "◉ " : "○ "}
                    {entry.text}
                  </Text>
                  <Box flexShrink={0}>
                    <Text color={entry.status === "failed" ? colors.danger : undefined} dimColor={entry.status !== "failed"}>
                      {entryDetail(entry)}
                    </Text>
                  </Box>
                </Box>
                {isHighlighted && entry.sentence && (
                  <Box flexDirection="column" paddingLeft={4}>
                    <ClozeSentence text={entry.sentence} />
                    {entry.sentenceTranslation && <Text dimColor>{entry.sentenceTranslation}</Text>}
                  </Box>
                )}
              </Box>
            );
          })}
        </Box>
      )}
      <Hints hints={isListFocused ? ["↑↓ to move", "enter edit sentence", "space select", "i import", "d delete", "tab to type", "esc back"] : ["enter to save", "tab to pick a word", "esc back"]} />
    </Box>
  );
}

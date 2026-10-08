import React, { useState } from "react";
import { Box, Text, useInput } from "ink";
import TextInput from "ink-text-input";
import type { LanguagePairing, OwnCollection, QuickCaptureEntry } from "../api.js";
import { ClozeSentence } from "../components/ClozeSentence.js";
import { ErrorMessage } from "../components/ErrorMessage.js";
import { Hints } from "../components/Hints.js";
import { ListRow } from "../components/ListRow.js";
import { Spinner } from "../components/Spinner.js";
import { cycledIndex } from "../cycle.js";
import { colors } from "../theme.js";
import { useQuickCaptureEntries } from "../useQuickCaptureEntries.js";
import { EditQuickCaptureEntry } from "./EditQuickCaptureEntry.js";
import { ImportQuickCapture } from "./ImportQuickCapture.js";

const LIST_HINTS = ["↑↓ to move", "enter edit sentence", "i import all", "d delete", "tab to type", "esc back"];
const INPUT_HINTS = ["enter to save", "tab to pick a word", "esc back"];

type QuickCaptureProps = { onBack: () => void; pairing: LanguagePairing };

export function QuickCapture({ onBack, pairing }: QuickCaptureProps) {
  const { addEntry, deleteEntry, entries, error, replaceEntry, showEntries } = useQuickCaptureEntries(pairing);
  const [text, setText] = useState("");
  const [isListFocused, setIsListFocused] = useState(false);
  const [highlighted, setHighlighted] = useState(0);
  const [entriesToImport, setEntriesToImport] = useState<QuickCaptureEntry[]>();
  const [importNotice, setImportNotice] = useState<string>();
  const [editedEntry, setEditedEntry] = useState<QuickCaptureEntry>();

  function saveTypedEntry(submitted: string) {
    const trimmed = submitted.trim();
    if (!trimmed) return;
    setText("");
    addEntry(trimmed);
  }

  function deleteHighlightedEntry(list: QuickCaptureEntry[]) {
    const remainingCount = list.length - 1;
    deleteEntry(list[highlighted]);
    setHighlighted(Math.max(0, Math.min(highlighted, remainingCount - 1)));
    if (remainingCount === 0) setIsListFocused(false);
  }

  function finishImport(collection: OwnCollection) {
    const importedIds = new Set(entriesToImport!.map((entry) => entry.id));
    const remaining = (entries || []).filter((entry) => !importedIds.has(entry.id));
    showEntries(remaining);
    setHighlighted(0);
    setIsListFocused(remaining.length > 0);
    setImportNotice(`Importing ${importedIds.size} into ${collection.name}. They'll show up there in a minute.`);
    setEntriesToImport(undefined);
  }

  function finishEditing(saved: QuickCaptureEntry) {
    replaceEntry(saved);
    setEditedEntry(undefined);
  }

  useInput((input, key) => {
    if (key.escape) return onBack();
    if (key.tab) return setIsListFocused((isFocused) => !isFocused && Boolean(entries?.length));
    if (!isListFocused || !entries?.length) return;
    if (key.upArrow) setHighlighted((index) => cycledIndex(index, -1, entries.length));
    if (key.downArrow) setHighlighted((index) => cycledIndex(index, 1, entries.length));
    if (input === "d") deleteHighlightedEntry(entries);
    if (input === "i") setEntriesToImport(entries);
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
        <TextInput focus={!isListFocused} onChange={setText} onSubmit={saveTypedEntry} placeholder="type a word or phrase" value={text} />
      </Box>
      {error && <ErrorMessage error={error} />}
      {importNotice && <Text color={colors.brand}>{importNotice}</Text>}
      {!entries && !error && <Spinner label="Loading your words…" />}
      {entries?.length === 0 && <Text dimColor>Nothing captured yet.</Text>}
      {entries && entries.length > 0 && (
        <Box flexDirection="column">
          {entries.map((entry, index) => (
            <EntryRow key={entry.id} entry={entry} isHighlighted={isListFocused && index === highlighted} />
          ))}
        </Box>
      )}
      <Hints hints={isListFocused ? LIST_HINTS : INPUT_HINTS} />
    </Box>
  );
}

function EntryRow({ entry, isHighlighted }: { entry: QuickCaptureEntry; isHighlighted: boolean }) {
  const hasFailed = entry.status === "failed";
  return (
    <Box flexDirection="column">
      <ListRow isHighlighted={isHighlighted} label={entry.text}>
        <Text color={hasFailed ? colors.danger : undefined} dimColor={!hasFailed}>
          {entryStatus(entry)}
        </Text>
      </ListRow>
      {isHighlighted && entry.sentence && (
        <Box flexDirection="column" paddingLeft={4}>
          <ClozeSentence text={entry.sentence} />
          {entry.sentenceTranslation && <Text dimColor>{entry.sentenceTranslation}</Text>}
        </Box>
      )}
    </Box>
  );
}

function entryStatus(entry: QuickCaptureEntry): string {
  if (entry.status === "failed") return "failed";
  if (entry.status === "processed") return entry.translation || "";
  return "translating…";
}

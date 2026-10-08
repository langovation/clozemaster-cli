import React, { useState } from "react";
import { Box, Text, useInput } from "ink";
import TextInput from "ink-text-input";
import { updateQuickCaptureEntry, type QuickCaptureEntry } from "../api.js";
import { moveCloze } from "../cloze.js";
import { ClozeSentence } from "../components/ClozeSentence.js";
import { ErrorMessage } from "../components/ErrorMessage.js";
import { Hints } from "../components/Hints.js";
import { Spinner } from "../components/Spinner.js";
import { colors } from "../theme.js";

type EditedField = "sentence" | "sentenceTranslation";

type EditQuickCaptureEntryProps = {
  entry: QuickCaptureEntry;
  onBack: () => void;
  onSaved: (entry: QuickCaptureEntry) => void;
};

export function EditQuickCaptureEntry({ entry, onBack, onSaved }: EditQuickCaptureEntryProps) {
  const [sentence, setSentence] = useState(entry.sentence || "");
  const [sentenceTranslation, setSentenceTranslation] = useState(entry.sentenceTranslation || "");
  const [editedField, setEditedField] = useState<EditedField>();
  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState<Error>();

  async function save() {
    setIsSaving(true);
    try {
      onSaved(await updateQuickCaptureEntry(entry, { sentence, sentenceTranslation }));
    } catch (error) {
      setSaveError(error as Error);
      setIsSaving(false);
    }
  }

  useInput((input, key) => {
    if (key.escape) return onBack();
    if (key.leftArrow) setSentence((current) => moveCloze(current, -1));
    if (key.rightArrow) setSentence((current) => moveCloze(current, 1));
    if (input === "e") setEditedField("sentence");
    if (input === "t") setEditedField("sentenceTranslation");
    if (key.return) save();
  }, { isActive: !editedField && !isSaving });

  useInput((_input, key) => {
    if (key.escape) setEditedField(undefined);
  }, { isActive: Boolean(editedField) });

  return (
    <Box flexDirection="column" gap={1}>
      <Box flexDirection="column">
        <Text bold>{entry.text}</Text>
        {entry.translation && <Text dimColor>{entry.translation}</Text>}
      </Box>
      <Box borderStyle="round" borderColor={colors.subtle} flexDirection="column" paddingX={1}>
        {editedField === "sentence" ? (
          <TextInput onChange={setSentence} onSubmit={() => setEditedField(undefined)} placeholder="sentence, with {{ }} around the hidden word" value={sentence} />
        ) : sentence ? (
          <ClozeSentence text={sentence} />
        ) : (
          <Text dimColor>No example sentence yet.</Text>
        )}
        {editedField === "sentenceTranslation" ? (
          <TextInput onChange={setSentenceTranslation} onSubmit={() => setEditedField(undefined)} placeholder="translation" value={sentenceTranslation} />
        ) : (
          sentenceTranslation && <Text dimColor>{sentenceTranslation}</Text>
        )}
      </Box>
      {isSaving && <Spinner label="Saving…" />}
      {saveError && <ErrorMessage error={saveError} />}
      <Hints
        hints={
          editedField
            ? ["enter done", "esc stop editing"]
            : ["←→ move the hidden word", "e edit sentence", "t edit translation", "enter save", "esc back"]
        }
      />
    </Box>
  );
}

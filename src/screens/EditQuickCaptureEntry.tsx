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
import { CLOZE_SENTENCE_PLACEHOLDER, FIELD_EDITING_HINTS, useEditedField } from "../useEditedField.js";
import { useSubmission } from "../useSubmission.js";

const MENU_HINTS = ["←→ move the hidden word", "e edit sentence", "t edit translation", "enter save", "esc back"];

type EditQuickCaptureEntryProps = {
  entry: QuickCaptureEntry;
  onBack: () => void;
  onSaved: (entry: QuickCaptureEntry) => void;
};

export function EditQuickCaptureEntry({ entry, onBack, onSaved }: EditQuickCaptureEntryProps) {
  const [sentence, setSentence] = useState(entry.sentence || "");
  const [sentenceTranslation, setSentenceTranslation] = useState(entry.sentenceTranslation || "");
  const { editedField, editField, stopEditing } = useEditedField<"sentence" | "sentenceTranslation">();
  const { error: saveError, isSubmitting: isSaving, submit } = useSubmission();

  function save() {
    submit(async () => onSaved(await updateQuickCaptureEntry(entry, { sentence, sentenceTranslation })));
  }

  useInput((input, key) => {
    if (key.escape) return onBack();
    if (key.leftArrow) setSentence((current) => moveCloze(current, -1));
    if (key.rightArrow) setSentence((current) => moveCloze(current, 1));
    if (input === "e") editField("sentence");
    if (input === "t") editField("sentenceTranslation");
    if (key.return) save();
  }, { isActive: !editedField && !isSaving });

  return (
    <Box flexDirection="column" gap={1}>
      <Box flexDirection="column">
        <Text bold>{entry.text}</Text>
        {entry.translation && <Text dimColor>{entry.translation}</Text>}
      </Box>
      <Box borderStyle="round" borderColor={colors.subtle} flexDirection="column" paddingX={1}>
        {editedField === "sentence" ? (
          <TextInput onChange={setSentence} onSubmit={stopEditing} placeholder={CLOZE_SENTENCE_PLACEHOLDER} value={sentence} />
        ) : (
          <ExampleSentence text={sentence} />
        )}
        {editedField === "sentenceTranslation" ? (
          <TextInput onChange={setSentenceTranslation} onSubmit={stopEditing} placeholder="translation" value={sentenceTranslation} />
        ) : (
          sentenceTranslation && <Text dimColor>{sentenceTranslation}</Text>
        )}
      </Box>
      {isSaving && <Spinner label="Saving…" />}
      {saveError && <ErrorMessage error={saveError} />}
      <Hints hints={editedField ? FIELD_EDITING_HINTS : MENU_HINTS} />
    </Box>
  );
}

function ExampleSentence({ text }: { text: string }) {
  if (!text) return <Text dimColor>No example sentence yet.</Text>;
  return <ClozeSentence text={text} />;
}

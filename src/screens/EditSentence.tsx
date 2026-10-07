import React, { useState } from "react";
import { Box, Text, useInput } from "ink";
import TextInput from "ink-text-input";
import { isProSubscriber, ProRequiredError, updateSentence, type Sentence } from "../api.js";
import { moveCloze } from "../cloze.js";
import { ErrorMessage } from "../components/ErrorMessage.js";
import { Hints } from "../components/Hints.js";
import { Spinner } from "../components/Spinner.js";
import { colors } from "../theme.js";
import { useRequest } from "../useRequest.js";
import { ClozeSentence } from "./EditQuickCaptureEntry.js";

type EditedField = "text" | "translation";

type EditSentenceProps = {
  isTextEditable: boolean;
  onBack: () => void;
  onSaved: (sentence: Sentence) => void;
  sentence: Sentence;
  upsertUrl: string;
};

export function EditSentence(props: EditSentenceProps) {
  const { data: isPro, error, isLoading } = useRequest(isProSubscriber);

  useInput((_input, key) => {
    if (key.escape) props.onBack();
  }, { isActive: !isPro });

  if (isLoading) return <Spinner label="Loading…" />;
  if (error) return <ErrorMessage error={error} />;
  if (!isPro) {
    return (
      <Box flexDirection="column" gap={1}>
        <ErrorMessage error={new ProRequiredError("Editing sentences needs Clozemaster Pro.", "edit_sentence")} />
        <Hints hints={["esc back"]} />
      </Box>
    );
  }
  return <SentenceEditor {...props} />;
}

function SentenceEditor({ isTextEditable, onBack, onSaved, sentence, upsertUrl }: EditSentenceProps) {
  const [text, setText] = useState(sentence.text);
  const [translation, setTranslation] = useState(sentence.translation);
  const [editedField, setEditedField] = useState<EditedField>();
  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState<Error>();

  async function save() {
    setIsSaving(true);
    const edited = { ...sentence, text, translation };
    try {
      await updateSentence({ sentence: edited, upsertUrl });
      onSaved(edited);
    } catch (error) {
      setSaveError(error as Error);
      setIsSaving(false);
    }
  }

  useInput((input, key) => {
    if (key.escape) return onBack();
    if (isTextEditable && key.leftArrow) setText((current) => moveCloze(current, -1));
    if (isTextEditable && key.rightArrow) setText((current) => moveCloze(current, 1));
    if (isTextEditable && input === "e") setEditedField("text");
    if (input === "t") setEditedField("translation");
    if (key.return) save();
  }, { isActive: !editedField && !isSaving });

  useInput((_input, key) => {
    if (key.escape) setEditedField(undefined);
  }, { isActive: Boolean(editedField) });

  return (
    <Box flexDirection="column" gap={1}>
      <Box borderStyle="round" borderColor={colors.subtle} flexDirection="column" paddingX={1}>
        {editedField === "text" ? (
          <TextInput onChange={setText} onSubmit={() => setEditedField(undefined)} placeholder="sentence, with {{ }} around the hidden word" value={text} />
        ) : (
          <ClozeSentence text={text} />
        )}
        {editedField === "translation" ? (
          <TextInput onChange={setTranslation} onSubmit={() => setEditedField(undefined)} placeholder="translation" value={translation} />
        ) : (
          <Text dimColor>{translation}</Text>
        )}
      </Box>
      {!isTextEditable && <Text dimColor>Only the translation can be changed: the sentence is in a collection you don't own.</Text>}
      {isSaving && <Spinner label="Saving…" />}
      {saveError && <ErrorMessage error={saveError} />}
      <Hints
        hints={
          editedField
            ? ["enter done", "esc stop editing"]
            : [...(isTextEditable ? ["←→ move the hidden word", "e edit sentence"] : []), "t edit translation", "enter save", "esc back"]
        }
      />
    </Box>
  );
}

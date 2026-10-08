import React, { useState } from "react";
import { Box, Text, useInput } from "ink";
import TextInput from "ink-text-input";
import { deleteSentence, isProSubscriber, ProRequiredError, updateSentence, type Sentence } from "../api.js";
import { ClozeSentence } from "../components/ClozeSentence.js";
import { ErrorMessage } from "../components/ErrorMessage.js";
import { Hints } from "../components/Hints.js";
import { Spinner } from "../components/Spinner.js";
import { colors } from "../theme.js";
import { useRequest } from "../useRequest.js";

type EditedField = "text" | "translation";

type EditSentenceProps = {
  isTextEditable: boolean;
  onBack: () => void;
  onDeleted: (sentence: Sentence) => void;
  onSaved: (sentence: Sentence) => void;
  sentence: Sentence;
  upsertUrl: string;
};

export function EditSentence(props: EditSentenceProps) {
  const { error, isLoading, result: isPro } = useRequest(isProSubscriber);

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

function SentenceEditor({ isTextEditable, onBack, onDeleted, onSaved, sentence, upsertUrl }: EditSentenceProps) {
  const [text, setText] = useState(sentence.text);
  const [translation, setTranslation] = useState(sentence.translation);
  const [editedField, setEditedField] = useState<EditedField>();
  const [isSaving, setIsSaving] = useState(false);
  const [isConfirmingDelete, setIsConfirmingDelete] = useState(false);
  const [saveError, setSaveError] = useState<Error>();
  const canDelete = isTextEditable && Boolean(sentence.url);

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

  async function remove() {
    setIsSaving(true);
    try {
      await deleteSentence(sentence);
      onDeleted(sentence);
    } catch (error) {
      setSaveError(error as Error);
      setIsSaving(false);
    }
  }

  useInput((input, key) => {
    if (key.escape) return onBack();
    if (isTextEditable && input === "e") setEditedField("text");
    if (input === "t") setEditedField("translation");
    if (canDelete && input === "d") setIsConfirmingDelete(true);
    if (key.return) save();
  }, { isActive: !editedField && !isSaving && !isConfirmingDelete });

  useInput((input) => {
    if (input === "y") remove();
    else setIsConfirmingDelete(false);
  }, { isActive: isConfirmingDelete && !isSaving });

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
      {isConfirmingDelete && !isSaving && <Text color={colors.danger}>Delete this sentence from the collection? y to delete, any other key to keep it</Text>}
      {isSaving && <Spinner label="Saving…" />}
      {saveError && <ErrorMessage error={saveError} />}
      <Hints
        hints={
          editedField
            ? ["enter done", "esc stop editing"]
            : [...(isTextEditable ? ["e edit sentence"] : []), "t edit translation", ...(canDelete ? ["d delete"] : []), "enter save", "esc back"]
        }
      />
    </Box>
  );
}

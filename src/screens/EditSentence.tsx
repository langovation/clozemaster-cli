import React, { useState } from "react";
import { Box, Text, useInput } from "ink";
import TextInput from "ink-text-input";
import { deleteSentence, isProSubscriber, ProRequiredError, updateSentence, type Sentence } from "../api.js";
import { ClozeSentence } from "../components/ClozeSentence.js";
import { ErrorMessage } from "../components/ErrorMessage.js";
import { Hints } from "../components/Hints.js";
import { Spinner } from "../components/Spinner.js";
import { colors } from "../theme.js";
import { CLOZE_SENTENCE_PLACEHOLDER, FIELD_EDITING_HINTS, useEditedField } from "../useEditedField.js";
import { useRequest } from "../useRequest.js";
import { useSubmission } from "../useSubmission.js";

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
  if (!isPro) return <EditingNeedsPro />;
  return <SentenceEditor {...props} />;
}

function EditingNeedsPro() {
  return (
    <Box flexDirection="column" gap={1}>
      <ErrorMessage error={new ProRequiredError("Editing sentences needs Clozemaster Pro.", "edit_sentence")} />
      <Hints hints={["esc back"]} />
    </Box>
  );
}

function SentenceEditor({ isTextEditable, onBack, onDeleted, onSaved, sentence, upsertUrl }: EditSentenceProps) {
  const [text, setText] = useState(sentence.text);
  const [translation, setTranslation] = useState(sentence.translation);
  const [isConfirmingDelete, setIsConfirmingDelete] = useState(false);
  const { editedField, editField, stopEditing } = useEditedField<"text" | "translation">();
  const { error: saveError, isSubmitting: isSaving, submit } = useSubmission();
  const canDelete = isTextEditable && Boolean(sentence.url);

  function save() {
    const edited = { ...sentence, text, translation };
    submit(async () => {
      await updateSentence({ sentence: edited, upsertUrl });
      onSaved(edited);
    });
  }

  function remove() {
    submit(async () => {
      await deleteSentence(sentence);
      onDeleted(sentence);
    });
  }

  useInput((input, key) => {
    if (key.escape) return onBack();
    if (isTextEditable && input === "e") editField("text");
    if (input === "t") editField("translation");
    if (canDelete && input === "d") setIsConfirmingDelete(true);
    if (key.return) save();
  }, { isActive: !editedField && !isSaving && !isConfirmingDelete });

  useInput((input) => {
    if (input === "y") remove();
    else setIsConfirmingDelete(false);
  }, { isActive: isConfirmingDelete && !isSaving });

  const menuHints = [...(isTextEditable ? ["e edit sentence"] : []), "t edit translation", ...(canDelete ? ["d delete"] : []), "enter save", "esc back"];

  return (
    <Box flexDirection="column" gap={1}>
      <Box borderStyle="round" borderColor={colors.subtle} flexDirection="column" paddingX={1}>
        {editedField === "text" ? (
          <TextInput onChange={setText} onSubmit={stopEditing} placeholder={CLOZE_SENTENCE_PLACEHOLDER} value={text} />
        ) : (
          <ClozeSentence text={text} />
        )}
        {editedField === "translation" ? (
          <TextInput onChange={setTranslation} onSubmit={stopEditing} placeholder="translation" value={translation} />
        ) : (
          <Text dimColor>{translation}</Text>
        )}
      </Box>
      {!isTextEditable && <Text dimColor>Only the translation can be changed: the sentence is in a collection you don't own.</Text>}
      {isConfirmingDelete && !isSaving && <Text color={colors.danger}>Delete this sentence from the collection? y to delete, any other key to keep it</Text>}
      {isSaving && <Spinner label="Saving…" />}
      {saveError && <ErrorMessage error={saveError} />}
      <Hints hints={editedField ? FIELD_EDITING_HINTS : menuHints} />
    </Box>
  );
}

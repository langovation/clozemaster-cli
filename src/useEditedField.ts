import { useState } from "react";
import { useInput } from "ink";

export const FIELD_EDITING_HINTS = ["enter done", "esc stop editing"];
export const CLOZE_SENTENCE_PLACEHOLDER = "sentence, with {{ }} around the hidden word";

export function useEditedField<Field extends string>() {
  const [editedField, setEditedField] = useState<Field>();
  const stopEditing = () => setEditedField(undefined);

  useInput((_input, key) => {
    if (key.escape) stopEditing();
  }, { isActive: Boolean(editedField) });

  return { editedField, editField: setEditedField, stopEditing };
}

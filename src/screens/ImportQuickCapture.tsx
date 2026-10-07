import React, { useState } from "react";
import { Box, Text, useInput } from "ink";
import TextInput from "ink-text-input";
import {
  createCollection,
  getOwnCollections,
  importQuickCaptureEntries,
  isProSubscriber,
  type LanguagePairing,
  type OwnCollection,
  type QuickCaptureEntry,
} from "../api.js";
import { ErrorMessage } from "../components/ErrorMessage.js";
import { Hints } from "../components/Hints.js";
import { Select } from "../components/Select.js";
import { Spinner } from "../components/Spinner.js";
import { colors } from "../theme.js";
import { useRequest } from "../useRequest.js";

const NEW_COLLECTION = "new";

type ImportQuickCaptureProps = {
  entries: QuickCaptureEntry[];
  onBack: () => void;
  onImported: (collection: OwnCollection) => void;
  pairing: LanguagePairing;
};

export function ImportQuickCapture({ entries, onBack, onImported, pairing }: ImportQuickCaptureProps) {
  const { data, error, isLoading } = useRequest(
    async () => ({ collections: await getOwnCollections(pairing), isPro: await isProSubscriber() }),
    [pairing.id],
  );
  const [isNaming, setIsNaming] = useState(false);
  const [newName, setNewName] = useState("");
  const [isImporting, setIsImporting] = useState(false);
  const [importError, setImportError] = useState<Error>();

  useInput((_input, key) => {
    if (!key.escape || isImporting) return;
    if (isNaming) setIsNaming(false);
    else onBack();
  });

  async function importInto(pickCollection: () => Promise<OwnCollection>) {
    setIsImporting(true);
    try {
      const collection = await pickCollection();
      await importQuickCaptureEntries(pairing, { collection, entries });
      onImported(collection);
    } catch (pickError) {
      setImportError(pickError as Error);
      setIsImporting(false);
    }
  }

  function pick(value: OwnCollection | typeof NEW_COLLECTION) {
    if (value === NEW_COLLECTION) setIsNaming(true);
    else importInto(async () => value);
  }

  function createAndImport(name: string) {
    if (name.trim()) importInto(() => createCollection(pairing, name.trim()));
  }

  const title = `Import ${entries.length} ${entries.length === 1 ? "word" : "words"}`;
  if (isLoading) return <Spinner label="Loading your collections…" />;
  if (error) return <ErrorMessage error={error} />;
  if (!data?.isPro) {
    return (
      <Box flexDirection="column" gap={1}>
        <Text bold>{title}</Text>
        <Text>Importing Quick Capture words into a collection is a Clozemaster Pro feature.</Text>
        <Hints hints={["esc back"]} />
      </Box>
    );
  }

  return (
    <Box flexDirection="column" gap={1}>
      <Text bold>{title}</Text>
      {isImporting && <Spinner label="Starting the import…" />}
      {!isImporting && isNaming && (
        <Box>
          <Text color={colors.brand}>❯ </Text>
          <TextInput onChange={setNewName} onSubmit={createAndImport} placeholder="new collection name" value={newName} />
        </Box>
      )}
      {!isImporting && !isNaming && (
        <Box flexDirection="column">
          <Text bold>Which collection?</Text>
          <Select
            items={[
              ...data.collections.map((collection) => ({ label: collection.name, value: collection as OwnCollection | typeof NEW_COLLECTION })),
              { label: "+ New collection", value: NEW_COLLECTION },
            ]}
            onSelect={pick}
          />
        </Box>
      )}
      {importError && <ErrorMessage error={importError} />}
      <Hints hints={[isNaming ? "enter to create and import" : "enter to import", "esc back"]} />
    </Box>
  );
}

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import type { CallToolResult } from "@modelcontextprotocol/sdk/types.js";
import { z } from "zod";
import {
  addQuickCaptureEntry,
  createCollection,
  deleteQuickCaptureEntry,
  getLanguagePairings,
  getOwnCollections,
  getQuickCaptureEntries,
  importQuickCaptureEntries,
  isProSubscriber,
  ProRequiredError,
  updateQuickCaptureEntry,
  type LanguagePairing,
  type QuickCaptureEntry,
} from "./api.js";
import { getAuthToken } from "./config.js";
import { currentVersion } from "./updateCheck.js";

const NOT_LOGGED_IN = "Not logged in to Clozemaster. Run `clozemaster` in a terminal and log in first.";

const languagePairingId = z.number().int().describe("Language pairing id from list_language_pairings");
const entryId = z.string().describe("Quick Capture entry id from list_quick_capture");

function isLoggedIn(): boolean {
  return Boolean(getAuthToken() || process.env.CLOZEMASTER_COOKIE);
}

function errorMessage(error: unknown): string {
  if (error instanceof ProRequiredError) return `${error.message} Upgrade at ${error.upgradeUrl}`;
  return error instanceof Error ? error.message : String(error);
}

function textResult(text: string, isError = false): CallToolResult {
  return { content: [{ type: "text", text }], ...(isError ? { isError } : {}) };
}

async function runTool(action: () => Promise<unknown>): Promise<CallToolResult> {
  if (!isLoggedIn()) return textResult(NOT_LOGGED_IN, true);
  try {
    return textResult(JSON.stringify(await action()));
  } catch (error) {
    return textResult(errorMessage(error), true);
  }
}

async function findLanguagePairing(id: number): Promise<LanguagePairing> {
  const pairing = (await getLanguagePairings()).find((candidate) => candidate.id === id);
  if (!pairing) throw new Error(`No language pairing with id ${id}. Call list_language_pairings for valid ids.`);
  return pairing;
}

async function findQuickCaptureEntries(pairing: LanguagePairing, ids: string[]): Promise<QuickCaptureEntry[]> {
  const entries = await getQuickCaptureEntries(pairing);
  return ids.map((id) => {
    const entry = entries.find((candidate) => candidate.id === id);
    if (!entry) throw new Error(`No Quick Capture entry with id ${id}. Call list_quick_capture for valid ids.`);
    return entry;
  });
}

async function findOwnCollection(pairing: LanguagePairing, id: number) {
  const collection = (await getOwnCollections(pairing)).find((candidate) => candidate.id === id);
  if (!collection) throw new Error(`No collection of yours with id ${id}. Call list_collections for valid ids.`);
  return collection;
}

function summarizePairing({ id, baseLanguageName, targetLanguageName }: LanguagePairing) {
  return { id, targetLanguage: targetLanguageName, baseLanguage: baseLanguageName };
}

function summarizeEntry({ id, sentence, sentenceTranslation, status, text, translation }: QuickCaptureEntry) {
  return { id, text, translation, sentence, sentenceTranslation, status };
}

async function importIntoCollection({
  collectionId,
  entryIds,
  languagePairingId,
}: {
  collectionId: number;
  entryIds: string[];
  languagePairingId: number;
}) {
  if (!(await isProSubscriber())) {
    throw new ProRequiredError("Importing Quick Capture words into a collection needs Clozemaster Pro.", "quick_capture_import");
  }
  const pairing = await findLanguagePairing(languagePairingId);
  const collection = await findOwnCollection(pairing, collectionId);
  const entries = await findQuickCaptureEntries(pairing, entryIds);
  await importQuickCaptureEntries(pairing, { collection, entries });
  return { importing: entries.length, collection };
}

export function createMcpServer(): McpServer {
  const server = new McpServer({ name: "clozemaster", version: currentVersion });

  server.registerTool(
    "list_language_pairings",
    { description: "List the languages the user is learning on Clozemaster. Every other tool needs one of these ids." },
    () => runTool(async () => (await getLanguagePairings()).map(summarizePairing)),
  );

  server.registerTool(
    "list_collections",
    {
      description: "List the user's own collections for a language pairing, most recently updated first.",
      inputSchema: { languagePairingId },
    },
    ({ languagePairingId }) => runTool(async () => getOwnCollections(await findLanguagePairing(languagePairingId))),
  );

  server.registerTool(
    "create_collection",
    {
      description: "Create a new, empty collection of the user's own in a language pairing.",
      inputSchema: { languagePairingId, name: z.string().min(1).describe("Collection name") },
    },
    ({ languagePairingId, name }) => runTool(async () => createCollection(await findLanguagePairing(languagePairingId), name)),
  );

  server.registerTool(
    "list_quick_capture",
    {
      description:
        "List Quick Capture entries: words or phrases the user saved to learn later. Clozemaster fills in a translation and an example sentence once status is processed.",
      inputSchema: { languagePairingId },
    },
    ({ languagePairingId }) =>
      runTool(async () => (await getQuickCaptureEntries(await findLanguagePairing(languagePairingId))).map(summarizeEntry)),
  );

  server.registerTool(
    "add_quick_capture",
    {
      description: "Save a word or phrase in the target language to Quick Capture. Clozemaster translates it and writes an example sentence.",
      inputSchema: { languagePairingId, text: z.string().min(1).describe("Word or phrase in the target language") },
    },
    ({ languagePairingId, text }) =>
      runTool(async () => summarizeEntry(await addQuickCaptureEntry(await findLanguagePairing(languagePairingId), text))),
  );

  server.registerTool(
    "update_quick_capture",
    {
      description: "Replace the example sentence and its translation of a Quick Capture entry.",
      inputSchema: {
        languagePairingId,
        entryId,
        sentence: z.string().min(1).describe("Example sentence in the target language using the entry's word"),
        sentenceTranslation: z.string().min(1).describe("Translation of the sentence into the base language"),
      },
    },
    ({ languagePairingId, entryId, sentence, sentenceTranslation }) =>
      runTool(async () => {
        const [entry] = await findQuickCaptureEntries(await findLanguagePairing(languagePairingId), [entryId]);
        return summarizeEntry(await updateQuickCaptureEntry(entry, { sentence, sentenceTranslation }));
      }),
  );

  server.registerTool(
    "delete_quick_capture",
    { description: "Delete a Quick Capture entry.", inputSchema: { languagePairingId, entryId } },
    ({ languagePairingId, entryId }) =>
      runTool(async () => {
        const [entry] = await findQuickCaptureEntries(await findLanguagePairing(languagePairingId), [entryId]);
        await deleteQuickCaptureEntry(entry);
        return { deleted: entryId };
      }),
  );

  server.registerTool(
    "import_quick_capture",
    {
      description:
        "Import Quick Capture entries into one of the user's own collections so they can be played. Runs in the background; imported entries leave Quick Capture. Needs Clozemaster Pro.",
      inputSchema: {
        languagePairingId,
        collectionId: z.number().int().describe("Collection id from list_collections or create_collection"),
        entryIds: z.array(z.string()).min(1).describe("Quick Capture entry ids to import"),
      },
    },
    (input) => runTool(() => importIntoCollection(input)),
  );

  return server;
}

export async function startMcpServer() {
  await createMcpServer().connect(new StdioServerTransport());
  console.error("Clozemaster MCP server running on stdio");
}

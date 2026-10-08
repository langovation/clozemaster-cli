import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import type { CallToolResult } from "@modelcontextprotocol/sdk/types.js";
import { z } from "zod";
import {
  ApiError,
  createCollection,
  createCollectionSentence,
  deleteCollectionSentence,
  getCollectionSentence,
  getCollectionSentences,
  getLanguagePairings,
  getOwnCollections,
  isProSubscriber,
  ProRequiredError,
  updateCollectionSentence,
  type CollectionSentence,
  type LanguagePairing,
  type NewCollectionSentence,
  type OwnCollection,
} from "./api.js";
import { getAuthToken } from "./config.js";
import { currentVersion } from "./updateCheck.js";

const NOT_LOGGED_IN = "Not logged in to Clozemaster. Run `clozemaster` in a terminal and log in first.";

const INSTRUCTIONS = `Manage the sentences in the user's own Clozemaster collections. Clozemaster teaches a language with cloze sentences: a sentence in the language being learned with one word hidden, which the learner fills in.

Typical workflow:
1. list_language_pairings: pick the pairing for the language the user means. Note its id, its targetLanguage (the language being learned, which sentences are written in) and its baseLanguage (the learner's own language, which translations are written in).
2. list_collections to pick one of the user's own collections, or create_collection to make a new one.
3. add_sentences to write sentences into it. list_sentences, update_sentence and delete_sentence review and fix them.

Only the user's own collections can be read or changed here. Adding sentences needs Clozemaster Pro.`;

const CLOZE_EXAMPLE = "`Ich {{habe}} Hunger.`";
const CLOZE_PATTERN = /^[^{}]*\{\{[^{}]*[^{}\s][^{}]*\}\}[^{}]*$/;
const MAX_ALTERNATIVE_ANSWERS_LENGTH = 100;
const MAX_NOTES_LENGTH = 200;
const MAX_SENTENCES_PER_CALL = 50;
const MAX_PER_PAGE = 100;

const languagePairingId = z
  .number()
  .int()
  .positive()
  .describe("`id` of a language pairing from list_language_pairings.");
const collectionId = z
  .number()
  .int()
  .positive()
  .describe("`id` of one of the user's own collections, from list_collections or create_collection.");
const sentenceId = z
  .number()
  .int()
  .positive()
  .describe("`id` of a sentence in that collection, from list_sentences or add_sentences.");
const clozeText = z
  .string()
  .regex(CLOZE_PATTERN, `text must contain exactly one non-empty {{cloze}} and no other braces, e.g. ${CLOZE_EXAMPLE}`)
  .describe(
    `The sentence in the pairing's targetLanguage, with exactly one word wrapped in double curly braces: the single word the learner is meant to learn, e.g. ${CLOZE_EXAMPLE}. No other braces anywhere.`,
  );
const translation = z
  .string()
  .trim()
  .min(1)
  .describe("Translation of the whole sentence into the pairing's baseLanguage. Plain text, no braces.");

const newSentence = z.object({
  text: clozeText,
  translation,
  hint: z
    .string()
    .trim()
    .min(1)
    .optional()
    .describe("Optional short clue shown before the learner answers, e.g. the hidden word's dictionary form. Must not give the answer away."),
  notes: z
    .string()
    .trim()
    .min(1)
    .max(MAX_NOTES_LENGTH)
    .optional()
    .describe(`Optional note kept with the sentence, at most ${MAX_NOTES_LENGTH} characters.`),
  alternativeAnswers: z
    .array(z.string().trim().min(1).regex(/^[^,]+$/, "an alternative answer can't contain a comma"))
    .refine(
      (answers) => answers.join(",").length <= MAX_ALTERNATIVE_ANSWERS_LENGTH,
      `alternativeAnswers joined with commas must be at most ${MAX_ALTERNATIVE_ANSWERS_LENGTH} characters`,
    )
    .optional()
    .describe(
      `Optional other words also accepted in place of the hidden word, e.g. another spelling. No commas; at most ${MAX_ALTERNATIVE_ANSWERS_LENGTH} characters in total.`,
    ),
  pronunciation: z
    .string()
    .trim()
    .min(1)
    .optional()
    .describe("Optional reading of the whole sentence shown after answering, e.g. pinyin or romaji. Only for languages not written in Latin script."),
});

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

async function requirePro() {
  if (!(await isProSubscriber())) {
    throw new ProRequiredError("Adding sentences to a collection needs Clozemaster Pro.", "mcp_add_sentences");
  }
}

async function findLanguagePairing(id: number): Promise<LanguagePairing> {
  const pairing = (await getLanguagePairings()).find((candidate) => candidate.id === id);
  if (!pairing) throw new Error(`No language pairing with id ${id}. Call list_language_pairings for valid ids.`);
  return pairing;
}

async function findOwnCollection(pairing: LanguagePairing, id: number): Promise<OwnCollection> {
  const collection = (await getOwnCollections(pairing)).find((candidate) => candidate.id === id);
  if (!collection) {
    throw new Error(`No collection of the user's own with id ${id} in this language pairing. Call list_collections for valid ids.`);
  }
  return collection;
}

async function findPairingAndCollection(ids: { languagePairingId: number; collectionId: number }) {
  const pairing = await findLanguagePairing(ids.languagePairingId);
  return { pairing, collection: await findOwnCollection(pairing, ids.collectionId) };
}

async function findSentence(pairing: LanguagePairing, collection: OwnCollection, id: number): Promise<CollectionSentence> {
  try {
    return await getCollectionSentence(pairing, { collection, id });
  } catch (error) {
    if (error instanceof ApiError && error.status === 404) {
      throw new Error(`No sentence with id ${id} in collection ${collection.id}. Call list_sentences for valid ids.`);
    }
    throw error;
  }
}

function summarizePairing({ id, baseLanguageName, targetLanguageName }: LanguagePairing) {
  return { id, targetLanguage: targetLanguageName, baseLanguage: baseLanguageName };
}

function summarizeSentence({ id, alternativeAnswers, hint, notes, pronunciation, text, translation }: CollectionSentence) {
  return { id, text, translation, hint, notes, alternativeAnswers, pronunciation };
}

async function listSentences(input: { languagePairingId: number; collectionId: number; page: number; perPage: number }) {
  const { pairing, collection } = await findPairingAndCollection(input);
  const { collectionClozeSentences, page, perPage, total } = await getCollectionSentences(pairing, {
    collection,
    page: input.page,
    perPage: input.perPage,
  });
  return {
    sentences: collectionClozeSentences.map(summarizeSentence),
    page,
    perPage,
    total,
    nextPage: page * perPage < total ? page + 1 : null,
  };
}

async function addSentences(input: { languagePairingId: number; collectionId: number; sentences: NewCollectionSentence[] }) {
  await requirePro();
  const { pairing, collection } = await findPairingAndCollection(input);
  const added = [];
  const failed = [];
  for (const [index, sentence] of input.sentences.entries()) {
    try {
      added.push({ index, ...summarizeSentence(await createCollectionSentence(pairing, { collection, sentence })) });
    } catch (error) {
      failed.push({ index, text: sentence.text, error: errorMessage(error) });
    }
  }
  return { added, failed };
}

async function updateSentence(input: {
  languagePairingId: number;
  collectionId: number;
  sentenceId: number;
  text: string;
  translation: string;
}) {
  const { pairing, collection } = await findPairingAndCollection(input);
  await findSentence(pairing, collection, input.sentenceId);
  await updateCollectionSentence(pairing, { collection, id: input.sentenceId, text: input.text, translation: input.translation });
  return { id: input.sentenceId, text: input.text, translation: input.translation };
}

async function deleteSentence(input: { languagePairingId: number; collectionId: number; sentenceId: number }) {
  const { pairing, collection } = await findPairingAndCollection(input);
  await findSentence(pairing, collection, input.sentenceId);
  await deleteCollectionSentence(pairing, { collection, id: input.sentenceId });
  return { deleted: input.sentenceId };
}

export function createMcpServer(): McpServer {
  const server = new McpServer({ name: "clozemaster", version: currentVersion }, { instructions: INSTRUCTIONS });

  server.registerTool(
    "list_language_pairings",
    {
      description:
        "List the languages the user is learning. Returns [{ id, targetLanguage, baseLanguage }]: targetLanguage is the language being learned (sentence text is written in it), baseLanguage is the learner's own (translations are written in it). Every other tool takes one of these ids as languagePairingId.",
    },
    () => runTool(async () => (await getLanguagePairings()).map(summarizePairing)),
  );

  server.registerTool(
    "list_collections",
    {
      description:
        "List the user's own collections in a language pairing, most recently updated first. Returns [{ id, name }]. Only these collections can be read or changed with the sentence tools.",
      inputSchema: { languagePairingId },
    },
    ({ languagePairingId }) => runTool(async () => getOwnCollections(await findLanguagePairing(languagePairingId))),
  );

  server.registerTool(
    "create_collection",
    {
      description: "Create a new, empty collection owned by the user in a language pairing. Returns { id, name }; pass that id as collectionId to add_sentences.",
      inputSchema: { languagePairingId, name: z.string().trim().min(1).describe("Name of the new collection, e.g. `Kitchen words`.") },
    },
    ({ languagePairingId, name }) => runTool(async () => createCollection(await findLanguagePairing(languagePairingId), name)),
  );

  server.registerTool(
    "list_sentences",
    {
      description:
        "List the sentences in one of the user's own collections, one page at a time. Returns { sentences: [{ id, text, translation, hint, notes, alternativeAnswers, pronunciation }], page, perPage, total, nextPage }. text marks the hidden word with {{double curly braces}}. nextPage is null on the last page.",
      inputSchema: {
        languagePairingId,
        collectionId,
        page: z.number().int().positive().default(1).describe("Page number, starting at 1."),
        perPage: z.number().int().min(1).max(MAX_PER_PAGE).default(20).describe(`Sentences per page, 1 to ${MAX_PER_PAGE}.`),
      },
    },
    (input) => runTool(() => listSentences(input)),
  );

  server.registerTool(
    "add_sentences",
    {
      description: `Add up to ${MAX_SENTENCES_PER_CALL} new sentences to one of the user's own collections. Needs Clozemaster Pro. Each sentence's text is in the pairing's targetLanguage with exactly one word wrapped in double curly braces, the single word the learner is meant to learn, e.g. ${CLOZE_EXAMPLE}; translation is the whole sentence in the pairing's baseLanguage (both languages come from list_language_pairings). Each sentence is saved separately: returns { added: [{ index, id, ... }], failed: [{ index, text, error }] }, where index is the position in the sentences array. A sentence fails, for example, when the collection already has the same text.`,
      inputSchema: {
        languagePairingId,
        collectionId,
        sentences: z.array(newSentence).min(1).max(MAX_SENTENCES_PER_CALL).describe("The sentences to add, in order."),
      },
    },
    (input) => runTool(() => addSentences(input)),
  );

  server.registerTool(
    "update_sentence",
    {
      description: `Replace the text and translation of a sentence in one of the user's own collections. Send both, even if only one changes. text is in the pairing's targetLanguage with exactly one word wrapped in double curly braces, the single word the learner is meant to learn, e.g. ${CLOZE_EXAMPLE}; translation is the whole sentence in the pairing's baseLanguage. Returns { id, text, translation }.`,
      inputSchema: { languagePairingId, collectionId, sentenceId, text: clozeText, translation },
    },
    (input) => runTool(() => updateSentence(input)),
  );

  server.registerTool(
    "delete_sentence",
    {
      description: "Permanently delete a sentence from one of the user's own collections. Returns { deleted: sentenceId }.",
      inputSchema: { languagePairingId, collectionId, sentenceId },
    },
    (input) => runTool(() => deleteSentence(input)),
  );

  return server;
}

export async function startMcpServer() {
  await createMcpServer().connect(new StdioServerTransport());
  console.error("Clozemaster MCP server running on stdio");
}

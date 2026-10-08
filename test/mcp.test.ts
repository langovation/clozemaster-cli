import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import type { CallToolResult } from "@modelcontextprotocol/sdk/types.js";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import * as api from "../src/api.js";
import { createMcpServer } from "../src/mcp.js";

vi.mock("../src/api.js", async (importOriginal) => ({
  ...(await importOriginal<typeof api>()),
  createCollection: vi.fn(),
  createCollectionSentence: vi.fn(),
  deleteCollectionSentence: vi.fn(),
  getCollectionSentence: vi.fn(),
  getCollectionSentences: vi.fn(),
  getLanguagePairings: vi.fn(),
  getOwnCollections: vi.fn(),
  isProSubscriber: vi.fn(),
  updateCollectionSentence: vi.fn(),
}));

const pairing: api.LanguagePairing = {
  id: 7,
  baseLanguageName: "English",
  currentStreakDays: 3,
  level: 2,
  numPointsToday: 10,
  score: 500,
  targetLanguageName: "German",
};

const collection = { id: 42, name: "Food" };

const sentence: api.CollectionSentence = {
  id: 900,
  alternativeAnswers: [],
  hint: null,
  notes: null,
  pronunciation: null,
  text: "Ich {{habe}} Hunger.",
  translation: "I am hungry.",
};

const ids = { languagePairingId: 7, collectionId: 42 };

async function connectClient() {
  const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
  await createMcpServer().connect(serverTransport);
  const client = new Client({ name: "test", version: "1.0.0" });
  await client.connect(clientTransport);
  return client;
}

async function callTool(name: string, args: Record<string, unknown> = {}) {
  const client = await connectClient();
  return (await client.callTool({ name, arguments: args })) as CallToolResult;
}

function resultText(result: CallToolResult): string {
  const [content] = result.content;
  return content.type === "text" ? content.text : "";
}

function resultJson(result: CallToolResult): unknown {
  expect(result.isError).toBeUndefined();
  return JSON.parse(resultText(result));
}

function expectToolError(result: CallToolResult, message: string) {
  expect(result.isError).toBe(true);
  expect(resultText(result)).toContain(message);
}

describe("MCP server", () => {
  beforeEach(() => {
    vi.stubEnv("CLOZEMASTER_TOKEN", "1:test");
    vi.mocked(api.getLanguagePairings).mockResolvedValue([pairing]);
    vi.mocked(api.getOwnCollections).mockResolvedValue([collection]);
    vi.mocked(api.getCollectionSentence).mockResolvedValue(sentence);
    vi.mocked(api.isProSubscriber).mockResolvedValue(true);
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.clearAllMocks();
  });

  it("lists every tool", async () => {
    const client = await connectClient();
    const { tools } = await client.listTools();
    expect(tools.map((tool) => tool.name)).toEqual([
      "list_language_pairings",
      "list_collections",
      "create_collection",
      "list_sentences",
      "add_sentences",
      "update_sentence",
      "delete_sentence",
    ]);
  });

  it("describes the workflow in the server instructions", async () => {
    const client = await connectClient();
    expect(client.getInstructions()).toContain("list_language_pairings");
  });

  it("tells the user to log in with the CLI when there is no saved login", async () => {
    vi.stubEnv("CLOZEMASTER_TOKEN", "");
    expectToolError(await callTool("list_language_pairings"), "Run `clozemaster` in a terminal and log in first");
  });

  it("lists language pairings with their ids and languages", async () => {
    const result = await callTool("list_language_pairings");
    expect(resultJson(result)).toEqual([{ id: 7, targetLanguage: "German", baseLanguage: "English" }]);
  });

  it("lists the user's own collections for a pairing", async () => {
    const result = await callTool("list_collections", { languagePairingId: 7 });
    expect(resultJson(result)).toEqual([collection]);
    expect(api.getOwnCollections).toHaveBeenCalledWith(pairing);
  });

  it("reports an unknown language pairing id as a tool error", async () => {
    expectToolError(await callTool("list_collections", { languagePairingId: 99 }), "No language pairing with id 99");
  });

  it("creates a collection", async () => {
    vi.mocked(api.createCollection).mockResolvedValue(collection);
    const result = await callTool("create_collection", { languagePairingId: 7, name: "Food" });
    expect(resultJson(result)).toEqual(collection);
    expect(api.createCollection).toHaveBeenCalledWith(pairing, "Food");
  });

  it("lists a page of sentences with the next page number", async () => {
    vi.mocked(api.getCollectionSentences).mockResolvedValue({ collectionClozeSentences: [sentence], page: 1, perPage: 1, total: 3 });
    const result = await callTool("list_sentences", { ...ids, perPage: 1 });
    expect(resultJson(result)).toEqual({ sentences: [sentence], page: 1, perPage: 1, total: 3, nextPage: 2 });
    expect(api.getCollectionSentences).toHaveBeenCalledWith(pairing, { collection, page: 1, perPage: 1 });
  });

  it("returns no next page on the last page", async () => {
    vi.mocked(api.getCollectionSentences).mockResolvedValue({ collectionClozeSentences: [sentence], page: 2, perPage: 20, total: 21 });
    const result = await callTool("list_sentences", { ...ids, page: 2 });
    expect(resultJson(result)).toMatchObject({ nextPage: null });
  });

  it("refuses collections the user doesn't own", async () => {
    expectToolError(await callTool("list_sentences", { ...ids, collectionId: 5 }), "No collection of the user's own with id 5");
    expect(api.getCollectionSentences).not.toHaveBeenCalled();
  });

  it("adds sentences and reports which failed", async () => {
    vi.mocked(api.createCollectionSentence)
      .mockResolvedValueOnce(sentence)
      .mockRejectedValueOnce(new Error("Text already exists in the collection with the same cloze"));
    const result = await callTool("add_sentences", {
      ...ids,
      sentences: [
        { text: "Ich {{habe}} Hunger.", translation: "I am hungry.", alternativeAnswers: ["hab"] },
        { text: "Du {{hast}} Durst.", translation: "You are thirsty." },
      ],
    });
    expect(resultJson(result)).toEqual({
      added: [{ index: 0, ...sentence }],
      failed: [{ index: 1, text: "Du {{hast}} Durst.", error: "Text already exists in the collection with the same cloze" }],
    });
    expect(api.createCollectionSentence).toHaveBeenCalledWith(pairing, {
      collection,
      sentence: { text: "Ich {{habe}} Hunger.", translation: "I am hungry.", alternativeAnswers: ["hab"] },
    });
  });

  it("refuses to add sentences for users without Pro", async () => {
    vi.mocked(api.isProSubscriber).mockResolvedValue(false);
    const result = await callTool("add_sentences", { ...ids, sentences: [{ text: "Ich {{habe}} Hunger.", translation: "I am hungry." }] });
    expectToolError(result, "needs Clozemaster Pro. Upgrade at");
    expect(api.createCollectionSentence).not.toHaveBeenCalled();
  });

  it.each([
    ["no cloze", "Ich habe Hunger."],
    ["two clozes", "{{Ich}} {{habe}} Hunger."],
    ["an empty cloze", "Ich {{ }} Hunger."],
    ["unbalanced braces", "Ich {{habe Hunger."],
  ])("rejects text with %s", async (_problem, text) => {
    const result = await callTool("add_sentences", { ...ids, sentences: [{ text, translation: "I am hungry." }] });
    expectToolError(result, "exactly one non-empty {{cloze}}");
    expect(api.createCollectionSentence).not.toHaveBeenCalled();
  });

  it("rejects alternative answers containing commas", async () => {
    const result = await callTool("add_sentences", {
      ...ids,
      sentences: [{ text: "Ich {{habe}} Hunger.", translation: "I am hungry.", alternativeAnswers: ["hab, habe"] }],
    });
    expectToolError(result, "can't contain a comma");
  });

  it("updates a sentence's text and translation", async () => {
    const update = { text: "Ich {{hatte}} Hunger.", translation: "I was hungry." };
    const result = await callTool("update_sentence", { ...ids, sentenceId: 900, ...update });
    expect(resultJson(result)).toEqual({ id: 900, ...update });
    expect(api.updateCollectionSentence).toHaveBeenCalledWith(pairing, { collection, id: 900, ...update });
  });

  it("doesn't update a sentence the collection doesn't have", async () => {
    vi.mocked(api.getCollectionSentence).mockRejectedValue(new api.ApiError("Clozemaster responded 404", 404));
    const result = await callTool("update_sentence", { ...ids, sentenceId: 1, text: "Ich {{habe}} Hunger.", translation: "I am hungry." });
    expectToolError(result, "No sentence with id 1 in collection 42");
    expect(api.updateCollectionSentence).not.toHaveBeenCalled();
  });

  it("deletes a sentence", async () => {
    const result = await callTool("delete_sentence", { ...ids, sentenceId: 900 });
    expect(resultJson(result)).toEqual({ deleted: 900 });
    expect(api.deleteCollectionSentence).toHaveBeenCalledWith(pairing, { collection, id: 900 });
  });

  it("surfaces API errors as tool errors", async () => {
    vi.mocked(api.getLanguagePairings).mockRejectedValue(new api.ApiError("Clozemaster responded 500", 500));
    const result = await callTool("list_language_pairings");
    expect(result.isError).toBe(true);
    expect(resultText(result)).toBe("Clozemaster responded 500");
  });
});

import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import type { CallToolResult } from "@modelcontextprotocol/sdk/types.js";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import * as api from "../src/api.js";
import { createMcpServer } from "../src/mcp.js";

vi.mock("../src/api.js", async (importOriginal) => ({
  ...(await importOriginal<typeof api>()),
  addQuickCaptureEntry: vi.fn(),
  createCollection: vi.fn(),
  deleteQuickCaptureEntry: vi.fn(),
  getLanguagePairings: vi.fn(),
  getOwnCollections: vi.fn(),
  getQuickCaptureEntries: vi.fn(),
  importQuickCaptureEntries: vi.fn(),
  isProSubscriber: vi.fn(),
  updateQuickCaptureEntry: vi.fn(),
}));

const pairing: api.LanguagePairing = {
  id: 7,
  baseLanguageName: "English",
  currentStreakDays: 3,
  level: 2,
  numPointsToday: 10,
  score: 500,
  targetLanguageName: "Spanish",
};

const entry: api.QuickCaptureEntry = {
  id: "abc",
  sentence: "Tengo un gato.",
  sentenceTranslation: "I have a cat.",
  status: "processed",
  text: "gato",
  translation: "cat",
  url: "https://www.clozemaster.com/api/v1/lp/7/quick_capture_entries/abc",
};

const collection = { id: 42, name: "Animals" };

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

describe("MCP server", () => {
  beforeEach(() => {
    vi.stubEnv("CLOZEMASTER_TOKEN", "1:test");
    vi.mocked(api.getLanguagePairings).mockResolvedValue([pairing]);
    vi.mocked(api.getQuickCaptureEntries).mockResolvedValue([entry]);
    vi.mocked(api.getOwnCollections).mockResolvedValue([collection]);
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
      "list_quick_capture",
      "add_quick_capture",
      "update_quick_capture",
      "delete_quick_capture",
      "import_quick_capture",
    ]);
  });

  it("tells the user to log in with the CLI when there is no saved login", async () => {
    vi.stubEnv("CLOZEMASTER_TOKEN", "");
    const result = await callTool("list_language_pairings");
    expect(result.isError).toBe(true);
    expect(resultText(result)).toContain("Run `clozemaster` in a terminal and log in first");
  });

  it("lists language pairings with their ids and languages", async () => {
    const result = await callTool("list_language_pairings");
    expect(resultJson(result)).toEqual([{ id: 7, targetLanguage: "Spanish", baseLanguage: "English" }]);
  });

  it("lists the user's own collections for a pairing", async () => {
    const result = await callTool("list_collections", { languagePairingId: 7 });
    expect(resultJson(result)).toEqual([collection]);
    expect(api.getOwnCollections).toHaveBeenCalledWith(pairing);
  });

  it("reports an unknown language pairing id as a tool error", async () => {
    const result = await callTool("list_collections", { languagePairingId: 99 });
    expect(result.isError).toBe(true);
    expect(resultText(result)).toContain("No language pairing with id 99");
  });

  it("creates a collection", async () => {
    vi.mocked(api.createCollection).mockResolvedValue(collection);
    const result = await callTool("create_collection", { languagePairingId: 7, name: "Animals" });
    expect(resultJson(result)).toEqual(collection);
    expect(api.createCollection).toHaveBeenCalledWith(pairing, "Animals");
  });

  it("lists Quick Capture entries without their API urls", async () => {
    const result = await callTool("list_quick_capture", { languagePairingId: 7 });
    expect(resultJson(result)).toEqual([
      { id: "abc", text: "gato", translation: "cat", sentence: "Tengo un gato.", sentenceTranslation: "I have a cat.", status: "processed" },
    ]);
  });

  it("adds a Quick Capture entry", async () => {
    vi.mocked(api.addQuickCaptureEntry).mockResolvedValue({ ...entry, status: "queued" });
    const result = await callTool("add_quick_capture", { languagePairingId: 7, text: "gato" });
    expect(resultJson(result)).toMatchObject({ id: "abc", status: "queued" });
    expect(api.addQuickCaptureEntry).toHaveBeenCalledWith(pairing, "gato");
  });

  it("updates a Quick Capture entry's sentence", async () => {
    vi.mocked(api.updateQuickCaptureEntry).mockResolvedValue({ ...entry, sentence: "El gato duerme." });
    const result = await callTool("update_quick_capture", {
      languagePairingId: 7,
      entryId: "abc",
      sentence: "El gato duerme.",
      sentenceTranslation: "The cat sleeps.",
    });
    expect(resultJson(result)).toMatchObject({ sentence: "El gato duerme." });
    expect(api.updateQuickCaptureEntry).toHaveBeenCalledWith(entry, { sentence: "El gato duerme.", sentenceTranslation: "The cat sleeps." });
  });

  it("deletes a Quick Capture entry", async () => {
    const result = await callTool("delete_quick_capture", { languagePairingId: 7, entryId: "abc" });
    expect(resultJson(result)).toEqual({ deleted: "abc" });
    expect(api.deleteQuickCaptureEntry).toHaveBeenCalledWith(entry);
  });

  it("reports an unknown Quick Capture entry id as a tool error", async () => {
    const result = await callTool("delete_quick_capture", { languagePairingId: 7, entryId: "missing" });
    expect(result.isError).toBe(true);
    expect(resultText(result)).toContain("No Quick Capture entry with id missing");
    expect(api.deleteQuickCaptureEntry).not.toHaveBeenCalled();
  });

  it("imports Quick Capture entries into a collection", async () => {
    const result = await callTool("import_quick_capture", { languagePairingId: 7, collectionId: 42, entryIds: ["abc"] });
    expect(resultJson(result)).toEqual({ importing: 1, collection });
    expect(api.importQuickCaptureEntries).toHaveBeenCalledWith(pairing, { collection, entries: [entry] });
  });

  it("refuses to import for users without Pro", async () => {
    vi.mocked(api.isProSubscriber).mockResolvedValue(false);
    const result = await callTool("import_quick_capture", { languagePairingId: 7, collectionId: 42, entryIds: ["abc"] });
    expect(result.isError).toBe(true);
    expect(resultText(result)).toContain("needs Clozemaster Pro. Upgrade at");
    expect(api.importQuickCaptureEntries).not.toHaveBeenCalled();
  });

  it("surfaces API errors as tool errors", async () => {
    vi.mocked(api.getLanguagePairings).mockRejectedValue(new api.ApiError("Clozemaster responded 500", 500));
    const result = await callTool("list_language_pairings");
    expect(result.isError).toBe(true);
    expect(resultText(result)).toBe("Clozemaster responded 500");
  });
});

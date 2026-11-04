import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import type { CallToolResult } from "@modelcontextprotocol/sdk/types.js";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import open from "open";
import * as api from "../src/api.js";
import { clearLogin, getAuthToken, saveLogin } from "../src/config.js";
import { createMcpServer } from "../src/mcp.js";

vi.mock("../src/api.js", async (importOriginal) => ({
  ...(await importOriginal<typeof api>()),
  pollCliLogin: vi.fn(),
  startCliLogin: vi.fn(),
}));

type JsonRpcRequest = { id?: number; method: string; params?: { name?: string; arguments?: Record<string, unknown> } };
type HostedCall = { authToken: string | null; client: string | null; message: JsonRpcRequest; url: string };

const hostedTools = [
  { name: "list_language_pairings", description: "List the languages the user is learning.", inputSchema: { type: "object", properties: {} } },
  { name: "add_sentences", description: "Add sentences.", inputSchema: { type: "object", properties: { collectionId: { type: "integer" } } } },
];
const hostedInstructions = "Manage the sentences in the user's own Clozemaster collections.";
const loginPrompt =
  "Not logged in to Clozemaster yet. A browser window opened to log in, showing the code ABCD-1234 (if it didn't open, visit https://example.com/cli). Ask the user to log in and approve it there, then call this tool again.";

let hostedCalls: HostedCall[];
let toolCallStatus: number;
let toolCallErrorBody: string;
let rejectsEveryToken: boolean;

function stubHostedServer() {
  hostedCalls = [];
  toolCallStatus = 200;
  toolCallErrorBody = "{}";
  rejectsEveryToken = false;
  vi.stubGlobal("fetch", vi.fn(async (input: string | URL, init: RequestInit = {}) => {
    const headers = new Headers(init.headers);
    if (init.method !== "POST") return new Response(null, { status: 405 });
    const message = JSON.parse(String(init.body)) as JsonRpcRequest;
    hostedCalls.push({ authToken: headers.get("Auth-Token"), client: headers.get("Clozemaster-Client"), message, url: String(input) });
    if (rejectsEveryToken && headers.has("Auth-Token")) return new Response("{}", { status: 401 });
    if (message.id === undefined) return new Response(null, { status: 202 });
    if (message.method === "tools/call" && toolCallStatus !== 200) return new Response(toolCallErrorBody, { status: toolCallStatus });
    return Response.json({ jsonrpc: "2.0", id: message.id, result: hostedResult(message) });
  }));
}

function hostedResult({ method, params }: JsonRpcRequest) {
  if (method === "initialize") {
    return { protocolVersion: "2025-06-18", capabilities: { tools: { listChanged: false } }, serverInfo: { name: "clozemaster", version: "1.0.0" }, instructions: hostedInstructions };
  }
  if (method === "tools/list") return { tools: hostedTools };
  if (params?.name === "add_sentences") return { content: [{ type: "text", text: "Adding sentences to a collection needs Clozemaster Pro." }], isError: true };
  return { content: [{ type: "text", text: JSON.stringify({ called: params?.name, with: params?.arguments }) }] };
}

async function connectClient() {
  const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
  await (await createMcpServer()).connect(serverTransport);
  const client = new Client({ name: "test", version: "1.0.0" });
  await client.connect(clientTransport);
  return client;
}

async function callTool(name: string, args: Record<string, unknown> = {}) {
  return (await (await connectClient()).callTool({ name, arguments: args })) as CallToolResult;
}

function resultText(result: CallToolResult): string {
  const [content] = result.content;
  return content.type === "text" ? content.text : "";
}

function toolCalls() {
  return hostedCalls.filter((call) => call.message.method === "tools/call");
}

describe("MCP server", () => {
  beforeEach(() => {
    vi.stubEnv("CLOZEMASTER_TOKEN", "1:test");
    stubHostedServer();
    vi.mocked(api.startCliLogin).mockResolvedValue({ deviceCode: "device", expiresIn: 600, pollInterval: 1, userCode: "ABCD-1234", verificationUrl: "https://example.com/cli" });
    vi.mocked(api.pollCliLogin).mockResolvedValue(null);
  });

  afterEach(() => {
    clearLogin();
    vi.unstubAllEnvs();
    vi.clearAllMocks();
  });

  it("passes calls through to the hosted Clozemaster MCP server", async () => {
    await callTool("list_language_pairings");
    expect(new Set(hostedCalls.map((call) => call.url))).toEqual(new Set(["https://www.clozemaster.com/mcp"]));
  });

  it("lists the hosted server's tools", async () => {
    const { tools } = await (await connectClient()).listTools();
    expect(tools).toEqual(hostedTools);
  });

  it("gives the hosted server's instructions", async () => {
    expect((await connectClient()).getInstructions()).toBe(hostedInstructions);
  });

  it("lists the tools before the user logs in", async () => {
    vi.stubEnv("CLOZEMASTER_TOKEN", "");
    const { tools } = await (await connectClient()).listTools();
    expect(tools.map((tool) => tool.name)).toEqual(["list_language_pairings", "add_sentences"]);
    expect(hostedCalls.every((call) => call.authToken === null)).toBe(true);
  });

  it("forgets a rejected saved login and still lists the tools", async () => {
    vi.stubEnv("CLOZEMASTER_TOKEN", "");
    saveLogin({ authToken: "1:expired", username: "learner" });
    rejectsEveryToken = true;
    const { tools } = await (await connectClient()).listTools();
    expect(tools).toEqual(hostedTools);
    expect(getAuthToken()).toBeUndefined();
  });

  it("gives the hosted server's instructions when the saved login is stale", async () => {
    vi.stubEnv("CLOZEMASTER_TOKEN", "");
    saveLogin({ authToken: "1:expired", username: "learner" });
    rejectsEveryToken = true;
    expect((await connectClient()).getInstructions()).toBe(hostedInstructions);
  });

  it("sends the CLI login token and says the call comes from the MCP server", async () => {
    api.identifyClientAs("mcp");
    await callTool("list_language_pairings");
    expect(toolCalls()[0]).toMatchObject({ authToken: "1:test", client: expect.stringMatching(/^mcp\//) });
  });

  it("passes a tool's arguments and result through unchanged", async () => {
    const result = await callTool("list_language_pairings", { page: 2 });
    expect(toolCalls()[0].message.params).toEqual({ name: "list_language_pairings", arguments: { page: 2 } });
    expect(resultText(result)).toBe(JSON.stringify({ called: "list_language_pairings", with: { page: 2 } }));
    expect(result.isError).toBeUndefined();
  });

  it("passes a tool error through unchanged", async () => {
    const result = await callTool("add_sentences", { collectionId: 1 });
    expect(result.isError).toBe(true);
    expect(resultText(result)).toBe("Adding sentences to a collection needs Clozemaster Pro.");
  });

  it("opens the browser login when there is no saved login, then uses the approved login", async () => {
    vi.useFakeTimers();
    vi.stubEnv("CLOZEMASTER_TOKEN", "");
    vi.mocked(api.pollCliLogin).mockResolvedValue({ authToken: "1:approved", username: "learner" });

    const client = await connectClient();
    const result = (await client.callTool({ name: "list_language_pairings", arguments: {} })) as CallToolResult;
    expect(result.isError).toBe(true);
    expect(resultText(result)).toBe(loginPrompt);
    expect(open).toHaveBeenCalledWith("https://example.com/cli");
    expect(toolCalls()).toEqual([]);

    await vi.advanceTimersByTimeAsync(1000);
    vi.useRealTimers();
    await client.callTool({ name: "list_language_pairings", arguments: {} });
    expect(toolCalls()[0].authToken).toBe("1:approved");
  });

  it("opens the browser login when there is only a cookie, which the hosted server doesn't accept", async () => {
    vi.stubEnv("CLOZEMASTER_TOKEN", "");
    vi.stubEnv("CLOZEMASTER_COOKIE", "session=abc");
    const result = await callTool("list_language_pairings");
    expect(resultText(result)).toBe(loginPrompt);
    expect(toolCalls()).toEqual([]);
  });

  describe("when the hosted server rejects the login", () => {
    beforeEach(() => {
      toolCallStatus = 401;
    });

    it("forgets a rejected saved login and asks to log in again in the browser", async () => {
      vi.stubEnv("CLOZEMASTER_TOKEN", "");
      saveLogin({ authToken: "1:expired", username: "learner" });
      const result = await callTool("list_language_pairings");
      expect(result.isError).toBe(true);
      expect(resultText(result)).toBe(loginPrompt);
      expect(getAuthToken()).toBeUndefined();
    });

    it("keeps reporting a rejected token from the environment", async () => {
      saveLogin({ authToken: "1:saved", username: "learner" });
      const result = await callTool("list_language_pairings");
      expect(resultText(result)).toBe("You're not logged in. Run `clozemaster login`.");
      vi.stubEnv("CLOZEMASTER_TOKEN", "");
      expect(getAuthToken()).toBe("1:saved");
    });
  });

  it("reports another failed status as a tool error", async () => {
    toolCallStatus = 500;
    const result = await callTool("list_language_pairings");
    expect(result.isError).toBe(true);
    expect(resultText(result)).toBe("Clozemaster responded 500");
  });

  it("tells the user to wait when they send too many requests", async () => {
    toolCallStatus = 429;
    const result = await callTool("list_language_pairings");
    expect(resultText(result)).toBe("Clozemaster is getting too many requests from you. Wait a few minutes and try again.");
  });

  it("passes through the hosted server's message for a request that's too large", async () => {
    toolCallStatus = 413;
    toolCallErrorBody = JSON.stringify({ jsonrpc: "2.0", id: null, error: { code: -32600, message: "Request body is larger than 4 MB." } });
    const result = await callTool("add_sentences", { collectionId: 1 });
    expect(resultText(result)).toBe("Request body is larger than 4 MB.");
  });

  it("reports an unreachable server as a tool error", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => Promise.reject(new TypeError("fetch failed"))));
    const result = await callTool("list_language_pairings");
    expect(result.isError).toBe(true);
    expect(resultText(result)).toBe("Couldn't reach https://www.clozemaster.com. Check your connection.");
  });
});

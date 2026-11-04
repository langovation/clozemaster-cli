import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StreamableHTTPClientTransport, StreamableHTTPError } from "@modelcontextprotocol/sdk/client/streamableHttp.js";
import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { CallToolRequestSchema, ListToolsRequestSchema, McpError, type CallToolResult } from "@modelcontextprotocol/sdk/types.js";
import { clientHeaders, identifyClientAs, type CliLoginStart } from "./api.js";
import { baseUrl, clearLogin, getAuthToken, isUsingSavedLogin } from "./config.js";
import { startOrResumeBrowserLogin } from "./mcpLogin.js";
import { updateInBackground } from "./selfUpdate.js";
import { currentVersion } from "./updateCheck.js";

// The tools live on the hosted Clozemaster MCP server; this passes calls through with the CLI's login.
export const remoteMcpUrl = `${baseUrl}/mcp`;

const CONNECT_TIMEOUT_MS = 10_000;

function errorResult(text: string): CallToolResult {
  return { content: [{ type: "text", text }], isError: true };
}

function notLoggedInMessage(login: CliLoginStart): string {
  return `Not logged in to Clozemaster yet. A browser window opened to log in, showing the code ${login.userCode} (if it didn't open, visit ${login.verificationUrl}). Ask the user to log in and approve it there, then call this tool again.`;
}

function errorMessage(error: unknown): string {
  if (isUnauthorized(error)) return "You're not logged in. Run `clozemaster login`.";
  if (error instanceof StreamableHTTPError && error.code === 429) return "Clozemaster is getting too many requests from you. Wait a few minutes and try again.";
  if (error instanceof StreamableHTTPError && error.code === 413) return serverErrorMessage(error) ?? "Clozemaster responded 413";
  if (error instanceof StreamableHTTPError) return `Clozemaster responded ${error.code}`;
  if (error instanceof McpError) return error.message;
  if (error instanceof Error && error.name === "TimeoutError") return `${baseUrl} took too long to answer. Try again.`;
  return `Couldn't reach ${baseUrl}. Check your connection.`;
}

// The SDK puts the response body after this prefix; the server's body is a JSON-RPC error.
function serverErrorMessage(error: StreamableHTTPError): string | undefined {
  const [, body] = error.message.split("Error POSTing to endpoint: ");
  try {
    return JSON.parse(body).error.message;
  } catch {
    return undefined;
  }
}

function isUnauthorized(error: unknown): boolean {
  return error instanceof StreamableHTTPError && error.code === 401;
}

// Reads the login on every request, so a login approved mid-session is used straight away.
const fetchWithLogin: typeof fetch = (url, init) => {
  const headers = new Headers(init?.headers);
  Object.entries(clientHeaders()).forEach(([name, value]) => headers.set(name, value));
  return fetch(url, { ...init, headers });
};

function remoteConnection(): () => Promise<Client> {
  let client: Promise<Client> | undefined;
  return () => {
    client ||= connectRemote().catch((error) => {
      client = undefined;
      throw error;
    });
    return client;
  };
}

async function connectClient(): Promise<Client> {
  const client = new Client({ name: "clozemaster-cli", version: currentVersion });
  await client.connect(new StreamableHTTPClientTransport(new URL(remoteMcpUrl), { fetch: fetchWithLogin }), { timeout: CONNECT_TIMEOUT_MS });
  return client;
}

// Connecting needs no login, so a rejected saved login is dropped and the next tool call asks for a fresh one.
async function connectRemote(): Promise<Client> {
  try {
    return await connectClient();
  } catch (error) {
    if (!isUnauthorized(error) || !isUsingSavedLogin()) throw error;
    clearLogin();
    return connectClient();
  }
}

async function loginPrompt(): Promise<CallToolResult> {
  return errorResult(notLoggedInMessage(await startOrResumeBrowserLogin()));
}

async function promptForFreshLogin(): Promise<CallToolResult> {
  clearLogin();
  try {
    return await loginPrompt();
  } catch (error) {
    return errorResult(errorMessage(error));
  }
}

async function callRemoteTool(remote: () => Promise<Client>, params: { name: string; arguments?: Record<string, unknown> }): Promise<CallToolResult> {
  try {
    if (!getAuthToken()) return await loginPrompt();
    return (await (await remote()).callTool(params)) as CallToolResult;
  } catch (error) {
    if (isUnauthorized(error) && isUsingSavedLogin()) return promptForFreshLogin();
    return errorResult(errorMessage(error));
  }
}

async function remoteInstructions(remote: () => Promise<Client>): Promise<string | undefined> {
  try {
    return (await remote()).getInstructions();
  } catch {
    return undefined;
  }
}

export async function createMcpServer(): Promise<Server> {
  const remote = remoteConnection();
  const server = new Server(
    { name: "clozemaster", version: currentVersion },
    { capabilities: { tools: { listChanged: true } }, instructions: await remoteInstructions(remote) },
  );
  server.setRequestHandler(ListToolsRequestSchema, async (request) => (await remote()).listTools(request.params));
  server.setRequestHandler(CallToolRequestSchema, (request) => callRemoteTool(remote, request.params));
  return server;
}

export async function startMcpServer() {
  identifyClientAs("mcp");
  await (await createMcpServer()).connect(new StdioServerTransport());
  console.error(`Clozemaster MCP server running on stdio, passing calls through to ${remoteMcpUrl}`);
  updateWhileRunning();
}

// Aborted when the client disconnects, or the download would keep the process alive.
async function updateWhileRunning() {
  const controller = new AbortController();
  process.stdin.once("close", () => controller.abort());
  const installedVersion = await updateInBackground(controller.signal);
  if (installedVersion) console.error(`Updated to Clozemaster CLI ${installedVersion}. It takes effect when the MCP server next starts.`);
}

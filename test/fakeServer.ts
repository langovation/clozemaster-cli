import fs from "node:fs";
import path from "node:path";
import { vi } from "vitest";

const fixture = (name: string) => JSON.parse(fs.readFileSync(path.join(__dirname, "fixtures", `${name}.json`), "utf8"));

export type RecordedRequest = { body?: Record<string, unknown>; method: string; url: URL };

// Answers every request from fixtures recorded off the real API; nothing leaves the machine.
export function startFakeServer() {
  const requests: RecordedRequest[] = [];
  const respond = (status: number, body: unknown) => new Response(JSON.stringify(body), { status });

  vi.stubGlobal("fetch", vi.fn(async (input: string, init: RequestInit = {}) => {
    const url = new URL(input);
    const method = init.method || "GET";
    requests.push({ body: init.body ? JSON.parse(String(init.body)) : undefined, method, url });

    if (method === "PUT" && url.pathname.endsWith("/ccs/answer")) {
      const answer = fixture("answer");
      return respond(200, { ...answer, languagePairing: { ...answer.languagePairing, numPointsToday: 52 } });
    }
    if (url.pathname === "/api/v1/lp") return respond(200, fixture("language_pairings"));
    if (/^\/api\/v1\/lp\/\d+\/c$/.test(url.pathname)) return respond(200, fixture("collections"));
    if (/^\/api\/v1\/lp\/\d+\/play$/.test(url.pathname)) return respond(200, fixture(`round_${url.searchParams.get("scope")}`));
    if (/^\/api\/v1\/lp\/\d+\/c\/\d+\/play$/.test(url.pathname)) return respond(200, fixture("round_collection"));
    return respond(404, {});
  }));

  return { answers: () => requests.filter((request) => request.method === "PUT"), requests };
}

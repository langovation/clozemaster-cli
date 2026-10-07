import fs from "node:fs";
import path from "node:path";
import { vi } from "vitest";

const fixture = (name: string) => JSON.parse(fs.readFileSync(path.join(__dirname, "fixtures", `${name}.json`), "utf8"));

export type RecordedRequest = { body?: Record<string, unknown>; method: string; url: URL };

// Answers every request from fixtures recorded off the real API; nothing leaves the machine.
export function startFakeServer({ isPro = true, latestCliVersion = "0.0.0" }: { isPro?: boolean; latestCliVersion?: string } = {}) {
  const requests: RecordedRequest[] = [];
  const respond = (status: number, body: unknown) => new Response(JSON.stringify(body), { status });
  let quickCaptureEntries: { id: string; sentence?: string; sentenceTranslation?: string; status: string; text: string; translation: string | null; url: string }[] = [];

  vi.stubGlobal("fetch", vi.fn(async (input: string, init: RequestInit = {}) => {
    const url = new URL(input);
    const method = init.method || "GET";
    requests.push({ body: init.body ? JSON.parse(String(init.body)) : undefined, method, url });

    if (method === "PUT" && url.pathname.endsWith("/ccs/answer")) {
      const answer = fixture("answer");
      return respond(200, { ...answer, languagePairing: { ...answer.languagePairing, numPointsToday: 52 } });
    }
    if (url.pathname === "/cli-version.txt") return new Response(`${latestCliVersion}\n`, { status: 200 });
    if (url.pathname === "/api/v1/lp") return respond(200, fixture("language_pairings"));
    if (/^\/api\/v1\/lp\/\d+$/.test(url.pathname)) {
      return respond(200, { languagePairing: { ...fixture("language_pairings").languagePairings[0], currentWeekLeaderboardRank: 3 } });
    }
    if (url.pathname === "/api/v1/users/pro_subscriber") return respond(200, { user: { isPro } });
    if (/^\/api\/v1\/lp\/\d+\/c$/.test(url.pathname) && method === "POST") {
      const { name } = requests.at(-1)!.body!.collection as { name: string };
      return respond(200, { collection: { id: 99, name } });
    }
    if (/^\/api\/v1\/lp\/\d+\/c$/.test(url.pathname) && url.searchParams.get("filter") === "mine") {
      return respond(200, { collections: [{ id: 5, name: "alex's Custom Collection" }, { id: 6, name: "Travel" }] });
    }
    if (/^\/api\/v1\/lp\/\d+\/c$/.test(url.pathname)) return respond(200, fixture("collections"));
    if (method === "POST" && /^\/api\/v1\/lp\/\d+\/quick_capture_imports$/.test(url.pathname)) {
      const { quick_capture_entry_ids: ids } = requests.at(-1)!.body as { quick_capture_entry_ids: string[] };
      quickCaptureEntries = quickCaptureEntries.filter((entry) => !ids.includes(entry.id));
      return respond(201, { quickCaptureImport: { id: "1", status: "pending" } });
    }
    if (/^\/api\/v1\/lp\/\d+\/play$/.test(url.pathname)) return respond(200, fixture(`round_${url.searchParams.get("scope")}`));
    if (/^\/api\/v1\/lp\/\d+\/c\/\d+\/play$/.test(url.pathname)) return respond(200, fixture("round_collection"));
    if (/^\/api\/v1\/lp\/\d+\/quick_capture_entries$/.test(url.pathname)) {
      if (method === "POST") {
        const text = (requests.at(-1)!.body!.quick_capture_entry as { text: string }).text;
        const id = String(quickCaptureEntries.length + 1);
        const entry = { id, sentence: `Veo un {{${text}}} aquí.`, sentenceTranslation: `I see a ${text} here.`, status: "processed", text, translation: `${text} (translated)`, url: `${url}/${id}` };
        quickCaptureEntries = [entry, ...quickCaptureEntries];
        return respond(201, { quickCaptureEntry: entry });
      }
      return respond(200, { quickCaptureEntries });
    }
    if (method === "PATCH" && /\/quick_capture_entries\/\d+$/.test(url.pathname)) {
      const { sentence, sentence_translation: sentenceTranslation } = requests.at(-1)!.body!.quick_capture_entry as { sentence: string; sentence_translation: string };
      quickCaptureEntries = quickCaptureEntries.map((entry) => (url.pathname.endsWith(`/${entry.id}`) ? { ...entry, sentence, sentenceTranslation } : entry));
      return respond(200, { quickCaptureEntry: quickCaptureEntries.find((entry) => url.pathname.endsWith(`/${entry.id}`)) });
    }
    if (method === "DELETE" && /\/quick_capture_entries\/\d+$/.test(url.pathname)) {
      quickCaptureEntries = quickCaptureEntries.filter((entry) => !url.pathname.endsWith(`/${entry.id}`));
      return new Response(null, { status: 204 });
    }
    return respond(404, {});
  }));

  return {
    answers: () => requests.filter((request) => request.method === "PUT"),
    imports: () => requests.filter((request) => request.url.pathname.endsWith("/quick_capture_imports")).map((request) => request.body),
    quickCaptureEntries: () => quickCaptureEntries,
    requests,
  };
}

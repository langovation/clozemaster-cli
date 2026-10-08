import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import * as api from "../src/api.js";
import { clearLogin, saveLogin } from "../src/config.js";
import { currentVersion } from "../src/updateCheck.js";

const pairing = { id: 7 } as api.LanguagePairing;
const collection = { id: 42, name: "Food" };
const sentence: api.Sentence = {
  alternativeAnswers: [],
  id: 900,
  level: 1,
  multipleChoiceOptions: null,
  nextReview: null,
  text: "Tengo {{mucha}} hambre.",
  translation: "I'm very hungry.",
};
const entry: api.QuickCaptureEntry = { id: "3", status: "processed", text: "gato", translation: "cat", url: "https://example.com/qce/3" };

function stubFetch(status = 200, body: unknown = {}) {
  const fetch = vi.fn(async () => (status === 204 ? new Response(null, { status }) : new Response(JSON.stringify(body), { status })));
  vi.stubGlobal("fetch", fetch);
  return fetch;
}

function lastRequest(fetch: ReturnType<typeof stubFetch>) {
  const [url, init] = fetch.mock.calls.at(-1) as unknown as [string, RequestInit];
  return { body: init.body ? JSON.parse(String(init.body)) : undefined, headers: init.headers as Record<string, string>, method: init.method, url: new URL(url) };
}

describe("api requests", () => {
  beforeEach(() => vi.stubEnv("CLOZEMASTER_TOKEN", "1:test"));

  afterEach(() => {
    clearLogin();
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
  });

  describe("headers", () => {
    it("sends JSON headers, the time zone and the auth token", async () => {
      const fetch = stubFetch(200, { user: { isPro: true } });
      await api.isProSubscriber();
      const { headers } = lastRequest(fetch);
      expect(headers).toMatchObject({
        Accept: "application/json",
        "Auth-Token": "1:test",
        "Content-Type": "application/json",
        "Time-Zone": Intl.DateTimeFormat().resolvedOptions().timeZone,
        "Time-Zone-Offset-Hours": String(-new Date().getTimezoneOffset() / 60),
      });
    });

    it("identifies requests as coming from the CLI by default", async () => {
      const fetch = stubFetch(200, { user: { isPro: true } });
      await api.isProSubscriber();
      expect(lastRequest(fetch).headers["Clozemaster-Client"]).toBe(`cli/${currentVersion}`);
    });

    it("identifies requests as coming from the MCP server once it says so", async () => {
      api.identifyClientAs("mcp");
      const fetch = stubFetch(200, { user: { isPro: true } });
      await api.isProSubscriber();
      expect(lastRequest(fetch).headers["Clozemaster-Client"]).toBe(`mcp/${currentVersion}`);
      api.identifyClientAs("cli");
    });

    it("sends the saved login's token when no token is set in the environment", async () => {
      vi.stubEnv("CLOZEMASTER_TOKEN", "");
      saveLogin({ authToken: "2:saved", username: "learner" });
      const fetch = stubFetch(200, { user: { isPro: true } });
      await api.isProSubscriber();
      expect(lastRequest(fetch).headers["Auth-Token"]).toBe("2:saved");
    });

    it("sends the session cookie from the environment", async () => {
      vi.stubEnv("CLOZEMASTER_COOKIE", "session=abc");
      const fetch = stubFetch(200, { user: { isPro: true } });
      await api.isProSubscriber();
      expect(lastRequest(fetch).headers.Cookie).toBe("session=abc");
    });

    it("sends no cookie without one in the environment", async () => {
      const fetch = stubFetch(200, { user: { isPro: true } });
      await api.isProSubscriber();
      expect(lastRequest(fetch).headers).not.toHaveProperty("Cookie");
    });
  });

  describe("errors", () => {
    it("says to log in on a 401", async () => {
      stubFetch(401);
      await expect(api.getLanguagePairings()).rejects.toMatchObject({ message: "You're not logged in. Run `clozemaster login`.", status: 401 });
    });

    it("reports any other failed status", async () => {
      stubFetch(500);
      await expect(api.getLanguagePairings()).rejects.toMatchObject({ message: "Clozemaster responded 500", status: 500 });
    });

    it("says the server couldn't be reached when the request fails", async () => {
      vi.stubGlobal("fetch", vi.fn(async () => Promise.reject(new TypeError("fetch failed"))));
      await expect(api.getLanguagePairings()).rejects.toMatchObject({ message: expect.stringContaining("Couldn't reach"), status: 0 });
    });

    it("gives up on a request after 30 seconds", async () => {
      const timeout = vi.spyOn(AbortSignal, "timeout");
      const fetch = stubFetch(200, { languagePairings: [] });
      await api.getLanguagePairings();
      expect(timeout).toHaveBeenCalledWith(30_000);
      expect((fetch.mock.calls[0] as unknown as [string, RequestInit])[1].signal).toBe(timeout.mock.results[0].value);
      timeout.mockRestore();
    });

    it("says when the server took too long", async () => {
      vi.stubGlobal("fetch", vi.fn(async () => Promise.reject(new DOMException("The operation was aborted due to timeout", "TimeoutError"))));
      await expect(api.getLanguagePairings()).rejects.toMatchObject({ message: expect.stringContaining("took too long to answer. Try again."), status: 0 });
    });

    it("throws ApiError instances", async () => {
      stubFetch(500);
      await expect(api.getLanguagePairings()).rejects.toBeInstanceOf(api.ApiError);
    });
  });

  describe("login", () => {
    it("starts a CLI login", async () => {
      const login = { deviceCode: "d", expiresIn: 600, pollInterval: 2, userCode: "ABCD", verificationUrl: "https://example.com/cli" };
      const fetch = stubFetch(200, login);
      expect(await api.startCliLogin()).toEqual(login);
      expect(lastRequest(fetch)).toMatchObject({ method: "POST", url: expect.objectContaining({ pathname: "/api/v1/cli_logins" }) });
    });

    it("polls a CLI login by its escaped device code", async () => {
      const fetch = stubFetch(200, { username: "learner" });
      await api.pollCliLogin("a/b");
      expect(lastRequest(fetch).url.pathname).toBe("/api/v1/cli_logins/a%2Fb");
    });

    it("resolves to null while the login isn't approved", async () => {
      stubFetch(200, { username: "learner" });
      expect(await api.pollCliLogin("device")).toBeNull();
    });

    it("resolves to the token and username once approved", async () => {
      stubFetch(200, { authToken: "1:new", username: "learner" });
      expect(await api.pollCliLogin("device")).toEqual({ authToken: "1:new", username: "learner" });
    });
  });

  describe("language pairings and collections", () => {
    it("lists only the user's language pairings", async () => {
      const fetch = stubFetch(200, { languagePairings: [pairing] });
      expect(await api.getLanguagePairings()).toEqual([pairing]);
      expect(lastRequest(fetch).url.toString()).toMatch(/\/api\/v1\/lp\?only_mine=true$/);
    });

    it("gets one language pairing", async () => {
      const fetch = stubFetch(200, { languagePairing: pairing });
      expect(await api.getLanguagePairing(pairing)).toEqual(pairing);
      expect(lastRequest(fetch).url.pathname).toBe("/api/v1/lp/7");
    });

    it("builds a language pairing's play path from its id", () => {
      expect(api.languagePairingPlayPath(pairing)).toBe("/lp/7/play");
    });

    it("lists a pairing's collections", async () => {
      const fetch = stubFetch(200, { collections: [collection] });
      expect(await api.getCollections(pairing)).toEqual([collection]);
      expect(lastRequest(fetch).url.pathname).toBe("/api/v1/lp/7/c");
    });

    it("lists the user's own collections, most recently updated first", async () => {
      const fetch = stubFetch(200, { collections: [collection] });
      expect(await api.getOwnCollections(pairing)).toEqual([collection]);
      expect(Object.fromEntries(lastRequest(fetch).url.searchParams)).toEqual({ filter: "mine", order: "updatedAt" });
    });

    it("creates a collection", async () => {
      const fetch = stubFetch(200, { collection });
      expect(await api.createCollection(pairing, "Food")).toEqual(collection);
      expect(lastRequest(fetch)).toMatchObject({ body: { collection: { name: "Food" } }, method: "POST" });
    });

    it("reports whether the user has Pro", async () => {
      stubFetch(200, { user: { isPro: null } });
      expect(await api.isProSubscriber()).toBe(false);
    });
  });

  describe("collection sentences", () => {
    it("gets a page of sentences", async () => {
      const page = { collectionClozeSentences: [], page: 2, perPage: 20, total: 0 };
      const fetch = stubFetch(200, page);
      expect(await api.getCollectionSentences(pairing, { collection, page: 2, perPage: 20 })).toEqual(page);
      const { url } = lastRequest(fetch);
      expect(url.pathname).toBe("/api/v1/lp/7/c/42/ccs");
      expect(Object.fromEntries(url.searchParams)).toEqual({ page: "2", per_page: "20" });
    });

    it("gets one sentence", async () => {
      const fetch = stubFetch(200, { collectionClozeSentence: { id: 900 } });
      expect(await api.getCollectionSentence(pairing, { collection, id: 900 })).toEqual({ id: 900 });
      expect(lastRequest(fetch).url.pathname).toBe("/api/v1/lp/7/c/42/ccs/900");
    });

    it("deletes one sentence", async () => {
      const fetch = stubFetch(204);
      await api.deleteCollectionSentence(pairing, { collection, id: 900 });
      expect(lastRequest(fetch)).toMatchObject({ method: "DELETE", url: expect.objectContaining({ pathname: "/api/v1/lp/7/c/42/ccs/900" }) });
    });
  });

  describe("quick capture", () => {
    it("lists entries", async () => {
      const fetch = stubFetch(200, { quickCaptureEntries: [entry] });
      expect(await api.getQuickCaptureEntries(pairing)).toEqual([entry]);
      expect(lastRequest(fetch).url.pathname).toBe("/api/v1/lp/7/quick_capture_entries");
    });

    it("adds an entry", async () => {
      const fetch = stubFetch(200, { quickCaptureEntry: entry });
      expect(await api.addQuickCaptureEntry(pairing, "gato")).toEqual(entry);
      expect(lastRequest(fetch)).toMatchObject({ body: { quick_capture_entry: { text: "gato" } }, method: "POST" });
    });

    it("updates an entry's sentence at its url", async () => {
      const fetch = stubFetch(200, { quickCaptureEntry: entry });
      await api.updateQuickCaptureEntry(entry, { sentence: "Un {{gato}}.", sentenceTranslation: "A cat." });
      expect(lastRequest(fetch)).toMatchObject({
        body: { quick_capture_entry: { sentence: "Un {{gato}}.", sentence_translation: "A cat." } },
        method: "PATCH",
        url: new URL(entry.url),
      });
    });

    it("deletes an entry at its url", async () => {
      const fetch = stubFetch(204);
      await api.deleteQuickCaptureEntry(entry);
      expect(lastRequest(fetch)).toMatchObject({ method: "DELETE", url: new URL(entry.url) });
    });

    it("imports entries into a collection, pinned to the dashboard", async () => {
      const fetch = stubFetch(201, {});
      await api.importQuickCaptureEntries(pairing, { collection, entries: [entry] });
      expect(lastRequest(fetch)).toMatchObject({
        body: { collection_id: 42, pin_to_dashboard: true, quick_capture_entry_ids: ["3"] },
        method: "POST",
        url: expect.objectContaining({ pathname: "/api/v1/lp/7/quick_capture_imports" }),
      });
    });
  });

  describe("rounds", () => {
    it.each([
      ["multiple_choice", "multiple_choice", "vocabulary"],
      ["text_input", "text_input", "vocabulary"],
      ["listening", "text_input", "listening"],
      ["flashcard", "multiple_choice", "vocabulary"],
    ] as const)("asks for a %s round as mode %s and skill %s", async (mode, apiMode, skill) => {
      const fetch = stubFetch(200, { collectionClozeSentences: [], wordBank: [] });
      await api.getRound({ mode, playDataUrl: "https://example.com/play" });
      expect(Object.fromEntries(lastRequest(fetch).url.searchParams)).toEqual({ count: "10", mode: apiMode, skill });
    });

    it("asks for a scope when given one", async () => {
      const fetch = stubFetch(200, { collectionClozeSentences: [], wordBank: [] });
      await api.getRound({ mode: "text_input", playDataUrl: "/lp/7/play", scope: "ready_for_review" });
      const { url } = lastRequest(fetch);
      expect(url.pathname).toBe("/api/v1/lp/7/play");
      expect(url.searchParams.get("scope")).toBe("ready_for_review");
    });

    it("says listening needs Pro once the free trial is used up", async () => {
      stubFetch(400);
      const round = api.getRound({ mode: "listening", playDataUrl: "https://example.com/play" });
      await expect(round).rejects.toBeInstanceOf(api.ProRequiredError);
      await expect(round).rejects.toMatchObject({ upgradeUrl: expect.stringMatching(/\/pro\?placement=cli_listening$/) });
    });

    it("passes on a 400 for other modes", async () => {
      stubFetch(400);
      await expect(api.getRound({ mode: "text_input", playDataUrl: "https://example.com/play" })).rejects.toBeInstanceOf(api.ApiError);
    });

    it("saves an answer with the local date, time spent and hint use", async () => {
      vi.useFakeTimers({ now: new Date(2026, 2, 4, 23, 30) });
      const fetch = stubFetch(200, { languagePairing: {} });
      await api.saveAnswer({ answerUrl: "https://example.com/answer", correct: true, mode: "listening", secondsSpent: 5, sentence, usedHint: false });
      vi.useRealTimers();
      expect(lastRequest(fetch)).toMatchObject({
        body: { correct: true, date: "2026-03-04", id: 900, mode: "text_input", skill: "listening", time: 5, used_hint: false },
        method: "PUT",
        url: new URL("https://example.com/answer"),
      });
    });
  });

  describe("sentences", () => {
    it("updates a sentence's text and translation through the upsert url", async () => {
      const fetch = stubFetch(200, {});
      await api.updateSentence({ sentence, upsertUrl: "https://example.com/upsert" });
      expect(lastRequest(fetch)).toMatchObject({
        body: { updates: [{ id: 900, text: sentence.text, translation: sentence.translation }] },
        method: "POST",
      });
    });

    it("marks a sentence known: mastered and never due again", async () => {
      const fetch = stubFetch(200, {});
      await api.markSentenceKnown({ sentence, upsertUrl: "https://example.com/upsert" });
      expect(lastRequest(fetch).body).toEqual({ updates: [{ id: 900, level: 4, next_review: "2100-01-01" }] });
    });

    it("deletes a sentence at its url", async () => {
      const fetch = stubFetch(204);
      await api.deleteSentence({ ...sentence, url: "https://example.com/ccs/900" });
      expect(lastRequest(fetch)).toMatchObject({ method: "DELETE", url: new URL("https://example.com/ccs/900") });
    });

    it("refuses to delete a sentence without a url", async () => {
      await expect(api.deleteSentence(sentence)).rejects.toThrow("this sentence can't be deleted.");
    });
  });

  describe("sentence audio", () => {
    it("uses the recorded audio without a request", async () => {
      const fetch = stubFetch();
      expect(await api.getSentenceAudioUrl({ ...sentence, ttsAudioUrl: "https://example.com/a.mp3" })).toBe("https://example.com/a.mp3");
      expect(fetch).not.toHaveBeenCalled();
    });

    it("asks the server to generate audio", async () => {
      stubFetch(200, { ttsAudioUrl: "https://example.com/tts.mp3" });
      expect(await api.getSentenceAudioUrl({ ...sentence, ttsUrl: "https://example.com/tts" })).toBe("https://example.com/tts.mp3");
    });

    it("has no audio without either url", async () => {
      expect(await api.getSentenceAudioUrl(sentence)).toBeUndefined();
    });
  });
});

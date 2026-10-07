import { afterEach, describe, expect, it, vi } from "vitest";
import { ExplanationLimitError, getExplanation, type Sentence } from "../src/api.js";

const sentence: Sentence = {
  alternativeAnswers: [],
  explanationJobUrl: "https://example.com/ccs-explanation-jobs",
  id: 1,
  level: 0,
  multipleChoiceOptions: [],
  nextReview: null,
  text: "Tengo {{mucha}} hambre.",
  translation: "I'm very hungry.",
};

const job = (status: string | null, explanation: string | null = null) => ({
  tracker: { explanation, status, structuredExplanation: null },
});

function stubResponses(...responses: [number, unknown][]) {
  const fetch = vi.fn();
  responses.forEach(([status, body]) => fetch.mockResolvedValueOnce(new Response(JSON.stringify(body), { status })));
  vi.stubGlobal("fetch", fetch);
  return fetch;
}

describe("getExplanation", () => {
  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it("uses the explanation the sentence already has without a request", async () => {
    const fetch = stubResponses();
    expect(await getExplanation({ ...sentence, explanation: "Mucha agrees with hambre." })).toEqual({
      structured: undefined,
      text: "Mucha agrees with hambre.",
    });
    expect(fetch).not.toHaveBeenCalled();
  });

  it("asks for one and polls until it's written", async () => {
    vi.useFakeTimers();
    const fetch = stubResponses([200, job(null)], [200, job("queued")], [200, job("working")], [200, job("complete", "Because.")]);
    const explanation = getExplanation({ ...sentence, id: 2 });
    await vi.advanceTimersByTimeAsync(4000);
    expect(await explanation).toEqual({ structured: undefined, text: "Because." });
    expect(fetch.mock.calls.map(([, init]) => init.method)).toEqual(["GET", "POST", "GET", "GET"]);
  });

  it("says when the monthly limit is used up", async () => {
    stubResponses([200, job(null)], [400, { error: "Maxed out requests this month." }]);
    await expect(getExplanation({ ...sentence, id: 3 })).rejects.toBeInstanceOf(ExplanationLimitError);
  });

  it("asks again when an earlier explanation failed", async () => {
    vi.useFakeTimers();
    const fetch = stubResponses([200, job("failed")], [200, job("queued")], [200, job("complete", "Because.")]);
    const explanation = getExplanation({ ...sentence, id: 4 });
    await vi.advanceTimersByTimeAsync(2000);
    expect(await explanation).toEqual({ structured: undefined, text: "Because." });
    expect(fetch.mock.calls.map(([, init]) => init.method)).toEqual(["GET", "POST", "GET"]);
  });

  it("fails when the job it asked for fails", async () => {
    vi.useFakeTimers();
    stubResponses([200, job(null)], [200, job("queued")], [200, job("failed")]);
    const explanation = getExplanation({ ...sentence, id: 5 });
    const failure = expect(explanation).rejects.toThrow("Couldn't explain");
    await vi.advanceTimersByTimeAsync(2000);
    await failure;
  });

  it("shares one request when asked twice for the same sentence", async () => {
    vi.useFakeTimers();
    const fetch = stubResponses([200, job(null)], [200, job("queued")], [200, job("complete", "Because.")]);
    const first = getExplanation({ ...sentence, id: 6 });
    const second = getExplanation({ ...sentence, id: 6 });
    await vi.advanceTimersByTimeAsync(2000);
    expect(await second).toEqual(await first);
    expect(fetch).toHaveBeenCalledTimes(3);
  });
});

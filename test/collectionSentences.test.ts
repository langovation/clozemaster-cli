import { afterEach, describe, expect, it, vi } from "vitest";
import { createCollectionSentence, updateCollectionSentence, type LanguagePairing } from "../src/api.js";

const pairing = { id: 7 } as LanguagePairing;
const collection = { id: 42, name: "Food" };
const savedSentence = { id: 900, text: "Ich {{habe}} Hunger.", translation: "I am hungry." };

function stubResponse(body: unknown) {
  const fetch = vi.fn().mockResolvedValue(new Response(JSON.stringify(body), { status: 200 }));
  vi.stubGlobal("fetch", fetch);
  return fetch;
}

function requestBody(fetch: ReturnType<typeof vi.fn>) {
  return JSON.parse(fetch.mock.calls[0][1].body);
}

describe("collection sentences", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("creates a sentence with its alternative answers joined by commas", async () => {
    const fetch = stubResponse({ collectionClozeSentence: savedSentence });
    const sentence = await createCollectionSentence(pairing, {
      collection,
      sentence: { text: "Ich {{habe}} Hunger.", translation: "I am hungry.", alternativeAnswers: ["hab", "hab'"] },
    });
    expect(sentence).toEqual(savedSentence);
    expect(fetch.mock.calls[0][0]).toMatch(/\/api\/v1\/lp\/7\/c\/42\/ccs$/);
    expect(requestBody(fetch)).toEqual({
      collection_cloze_sentence: { text: "Ich {{habe}} Hunger.", translation: "I am hungry.", alternative_answers: "hab,hab'" },
    });
  });

  it("throws the server's errors when a new sentence doesn't save", async () => {
    stubResponse({ errors: "Text already exists in the collection with the same cloze" });
    await expect(
      createCollectionSentence(pairing, { collection, sentence: { text: "Ich {{habe}} Hunger.", translation: "I am hungry." } }),
    ).rejects.toThrow("Text already exists in the collection with the same cloze");
  });

  it("updates a sentence through the upsert endpoint", async () => {
    const fetch = stubResponse({ ids: [900] });
    await updateCollectionSentence(pairing, { collection, id: 900, text: "Ich {{hatte}} Hunger.", translation: "I was hungry." });
    expect(requestBody(fetch)).toEqual({ updates: [{ id: 900, text: "Ich {{hatte}} Hunger.", translation: "I was hungry." }] });
  });

  it("throws the server's errors when an update doesn't save", async () => {
    stubResponse({ errors: "Validation failed" });
    await expect(
      updateCollectionSentence(pairing, { collection, id: 900, text: "Ich {{hatte}} Hunger.", translation: "I was hungry." }),
    ).rejects.toThrow("Validation failed");
  });
});

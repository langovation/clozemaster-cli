import { languagePairingPlayPath, type Collection, type LanguagePairing, type Sentence } from "./api.js";

export type RoundChoice = { answerUrl?: string; playDataUrl: string; scope?: string; title: string; upsertUrl?: string };

export function collectionRoundChoice(collection: Collection): RoundChoice {
  return {
    answerUrl: collection.collectionClozeSentencesAnswerUrl,
    playDataUrl: collection.playDataUrl,
    title: collection.name,
    upsertUrl: collection.collectionClozeSentencesUpsertUrl,
  };
}

export function reviewRoundChoice(pairing: LanguagePairing): RoundChoice {
  return { playDataUrl: languagePairingPlayPath(pairing), scope: "ready_for_review", title: "Review" };
}

export function answerUrlFor(sentence: Sentence, choice: RoundChoice): string | undefined {
  return sentence.collectionClozeSentencesAnswerUrl || choice.answerUrl;
}

export function upsertUrlFor(sentence: Sentence, choice: RoundChoice): string | undefined {
  return sentence.collectionClozeSentencesUpsertUrl || choice.upsertUrl;
}

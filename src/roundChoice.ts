import { languagePairingPlayPath, type Collection, type LanguagePairing } from "./api.js";

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

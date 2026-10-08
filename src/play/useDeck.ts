import { useState } from "react";
import type { Sentence } from "../api.js";

const ONE_DAY_MS = 24 * 60 * 60 * 1000;

export function useDeck(sentences: Sentence[]) {
  const [cards, setCards] = useState(sentences);
  const [index, setIndex] = useState(0);

  // Due tomorrow, so the retry scores like the server will score it.
  function requeueMissed(missed: Sentence) {
    setCards((current) => [...current, { ...missed, level: 0, nextReview: tomorrow() }]);
  }

  function dropLastRequeued() {
    setCards((current) => current.slice(0, -1));
  }

  function advance() {
    setIndex((current) => current + 1);
  }

  // A missed sentence is in the deck twice, so both copies take the edit.
  function applyEdit(edited: Sentence) {
    setCards((current) => current.map((card) => (card.id === edited.id ? { ...card, text: edited.text, translation: edited.translation } : card)));
  }

  function removeUpcoming(deleted: Sentence) {
    setCards((current) => current.filter((card, position) => position < index || card.id !== deleted.id));
  }

  return {
    advance,
    applyEdit,
    dropLastRequeued,
    index,
    isFinished: index >= cards.length,
    moveTo: setIndex,
    removeUpcoming,
    requeueMissed,
    sentence: cards[index],
    size: cards.length,
    upcoming: cards[index + 1] as Sentence | undefined,
  };
}

function tomorrow(): string {
  return new Date(Date.now() + ONE_DAY_MS).toISOString();
}

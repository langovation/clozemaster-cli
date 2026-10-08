import { useEffect, useState } from "react";
import type { PlayMode, Sentence } from "../api.js";
import { playSentenceAudio } from "../audio.js";

export type PlaySentence = typeof playSentenceAudio;

type ListeningOptions = { mode: PlayMode; onHeard: () => void; sentence: Sentence };

// Like the web's listening skill: the sentence stays hidden until its audio has played through once.
export function useListening({ mode, onHeard, sentence }: ListeningOptions) {
  const [isListening, setIsListening] = useState(mode === "listening");

  useEffect(() => {
    if (isListening && sentence) listen(playSentenceAudio);
  }, [sentence]);

  async function listen(play: PlaySentence) {
    if (await play(sentence)) {
      setIsListening(false);
      onHeard();
    }
  }

  function listenToNextSentence() {
    setIsListening(mode === "listening");
  }

  return { isListening, listen, listenToNextSentence };
}

import { useEffect } from "react";
import type { PlayMode, Sentence } from "../api.js";
import { playSentenceAudio, playSoundEffect, preloadSentenceAudio, stopAudio } from "../audio.js";
import type { AnsweredSentence } from "../components/SentenceCard.js";
import { useSettings } from "../SettingsContext.js";

type RoundAudioOptions = { answered?: AnsweredSentence; isRevealed: boolean; mode: PlayMode; sentence: Sentence; upcoming?: Sentence };

export function useRoundAudio({ answered, isRevealed, mode, sentence, upcoming }: RoundAudioOptions) {
  const { settings } = useSettings();

  useEffect(() => {
    if (mode !== "listening" && !settings.audio) return;
    [sentence, upcoming].forEach((each) => each && preloadSentenceAudio(each));
  }, [sentence]);

  useEffect(() => {
    if (answered) playAfterAnswering(answered);
  }, [answered]);

  useEffect(() => {
    if (isRevealed && settings.audio) playSentenceAudio(sentence);
  }, [isRevealed, sentence]);

  useEffect(() => stopAudio, []);

  async function playAfterAnswering({ isCorrect }: AnsweredSentence) {
    const isChimeDone = isCorrect && settings.soundEffects ? await playSoundEffect("correct") : true;
    if (isChimeDone && mode !== "listening" && settings.audio) playSentenceAudio(sentence);
  }
}

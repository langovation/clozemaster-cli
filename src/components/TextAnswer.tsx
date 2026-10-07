import React, { useState } from "react";
import { Box, Text, useInput } from "ink";
import TextInput from "ink-text-input";
import type { Sentence } from "../api.js";
import { cycleLastLetterAccent } from "../accents.js";
import { isCorrectAnswer, isOnTrack, lettersOff, withNextLetter } from "../answers.js";
import { useSettings } from "../SettingsContext.js";
import { colors } from "../theme.js";

type TextAnswerProps = { hasUsedHint: boolean; onAnswer: (answer: string) => void; onHint: () => void; sentence: Sentence };

export function TextAnswer({ hasUsedHint, onAnswer, onHint, sentence }: TextAnswerProps) {
  const { settings } = useSettings();
  const [answer, setAnswer] = useState("");
  const [spellingHint, setSpellingHint] = useState<{ answer: string; lettersOff: number }>();
  const check = { strictAccents: settings.strictAccents };

  useInput((_input, key) => {
    // Like the web: one letter hint per sentence.
    if (key.rightArrow && !hasUsedHint) {
      onHint();
      setAnswer((current) => withNextLetter(current, sentence, check));
    }
    if (key.upArrow) setAnswer((current) => cycleLastLetterAccent(current, 1));
    if (key.downArrow) setAnswer((current) => cycleLastLetterAccent(current, -1));
  });

  // Like the web: a near miss gets one "off by N" nudge; submitting the same text again grades it.
  function submit(submitted: string) {
    // Like the web, which disables submit on an empty answer: a stray enter shouldn't count as a miss.
    if (!submitted.trim()) return;
    const offBy = settings.spellingHints && !isCorrectAnswer(submitted, sentence, check) && lettersOff(submitted, sentence, check);
    if (offBy && spellingHint?.answer !== submitted) {
      setSpellingHint({ answer: submitted, lettersOff: offBy });
      return;
    }
    onAnswer(submitted);
  }

  const typingColor = settings.typingColorHint && answer ? (isOnTrack(answer, sentence, check) ? colors.brand : colors.danger) : undefined;

  return (
    <Box flexDirection="column">
      <Box>
        <Text color={colors.brand}>❯ </Text>
        <Text color={typingColor}>
          <TextInput
            value={answer}
            onChange={setAnswer}
            onSubmit={submit}
            placeholder="type the missing word"
          />
        </Text>
      </Box>
      {spellingHint && (
        <Text color={colors.gold}>
          Off by {spellingHint.lettersOff} {spellingHint.lettersOff === 1 ? "letter" : "letters"}. Enter again to submit anyway.
        </Text>
      )}
    </Box>
  );
}

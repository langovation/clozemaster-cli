import React, { useEffect, useRef, useState } from "react";
import { Box, measureElement, Text, useInput, useStdout, type DOMElement } from "ink";
import { getExplanation, type ExplanationWord, type Sentence, type StructuredExplanation } from "../api.js";
import { colors } from "../theme.js";
import { useRequest } from "../useRequest.js";
import { ErrorMessage } from "./ErrorMessage.js";
import { Spinner } from "./Spinner.js";

const SECTION_LABELS: Record<StructuredExplanation["sections"][number]["type"], string> = {
  grammar: "Grammar",
  pitfall: "Common mistake",
  register: "Register",
};

function Word({ word }: { word: ExplanationWord }) {
  const tags = [word.pos, ...word.features.map((feature) => feature.replace(/_/g, " "))].join(", ");
  return (
    <Box flexDirection="column">
      <Text>
        <Text bold color={colors.brand}>{word.surface}</Text>
        {word.reading && <Text dimColor> [{word.reading}]</Text>}
        <Text> {word.gloss}</Text>
      </Text>
      <Box paddingLeft={2} flexDirection="column">
        <Text dimColor>
          {word.lemma.toLowerCase() !== word.surface.toLowerCase() ? `${word.lemma} · ` : ""}
          {tags}
        </Text>
        {word.note && <Text>{word.note}</Text>}
      </Box>
    </Box>
  );
}

function Block({ children, label }: { children: React.ReactNode; label: string }) {
  return (
    <Box flexDirection="column">
      <Text bold color={colors.gold}>{label}</Text>
      {children}
    </Box>
  );
}

// Mirrors the mobile app's explanation sheet.
function Structured({ explanation }: { explanation: StructuredExplanation }) {
  return (
    <Box flexDirection="column" gap={1}>
      <Box flexDirection="column">
        <Text dimColor>{explanation.translation}</Text>
        {explanation.sentenceReading && <Text dimColor>{explanation.sentenceReading}</Text>}
      </Box>
      <Box flexDirection="column">
        {explanation.breakdown.map((word, index) => (
          <Word key={`${word.surface}-${index}`} word={word} />
        ))}
      </Box>
      {explanation.literalTranslation && <Block label="Literally"><Text>{explanation.literalTranslation}</Text></Block>}
      {explanation.alternative && <Block label="Alternative"><Text>{explanation.alternative}</Text></Block>}
      {explanation.sections.map((section, index) => (
        <Block key={index} label={SECTION_LABELS[section.type]}>
          <Text>{section.body}</Text>
          {section.examples.map((example) => (
            <Text key={example.text}>
              <Text italic>{example.text}</Text>
              <Text dimColor> - {example.translation}</Text>
            </Text>
          ))}
        </Block>
      ))}
    </Box>
  );
}

export function canExplain(sentence: Sentence): boolean {
  return Boolean(sentence.structuredExplanation || sentence.explanation || sentence.explanationJobUrl);
}

// Room left for the explanation once the sentence, hints and borders are on screen.
const ROWS_AROUND_EXPLANATION = 16;
const MIN_VISIBLE_ROWS = 6;

// Ink can't scroll, so a long explanation is clipped to the terminal and moved with the arrows.
function Scrollable({ children }: { children: React.ReactNode }) {
  const { stdout } = useStdout();
  const visibleRows = Math.max(MIN_VISIBLE_ROWS, (stdout.rows || 24) - ROWS_AROUND_EXPLANATION);
  const content = useRef<DOMElement>(null);
  const [contentRows, setContentRows] = useState(0);
  const [scrolledRows, setScrolledRows] = useState(0);
  const maxScroll = Math.max(0, contentRows - visibleRows);

  useEffect(() => {
    if (content.current) setContentRows(measureElement(content.current).height);
  });

  useInput((_input, key) => {
    if (key.downArrow) setScrolledRows((current) => Math.min(current + 1, maxScroll));
    if (key.upArrow) setScrolledRows((current) => Math.max(current - 1, 0));
  }, { isActive: maxScroll > 0 });

  if (maxScroll === 0) return <Box flexDirection="column" ref={content}>{children}</Box>;
  return (
    <Box flexDirection="column">
      <Box flexDirection="column" height={visibleRows} overflowY="hidden">
        <Box flexDirection="column" flexShrink={0} marginTop={-scrolledRows} ref={content}>{children}</Box>
      </Box>
      <Text dimColor>↑↓ scroll · {Math.round((scrolledRows / maxScroll) * 100)}%</Text>
    </Box>
  );
}

export function ExplanationPanel({ sentence }: { sentence: Sentence }) {
  const { data: explanation, error, isLoading } = useRequest(() => getExplanation(sentence), [sentence.id]);
  return (
    <Box borderStyle="round" borderColor={colors.gold} flexDirection="column" paddingX={1}>
      <Text bold>Explanation</Text>
      {isLoading && <Spinner label="Explaining… this may take a few seconds" />}
      {error && <ErrorMessage error={error} />}
      <Scrollable>
        {explanation?.structured && <Structured explanation={explanation.structured} />}
        {explanation && !explanation.structured && <Text>{explanation.text}</Text>}
      </Scrollable>
    </Box>
  );
}

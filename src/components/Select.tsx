import React, { useState } from "react";
import { Box, Text, useInput } from "ink";
import { colors } from "../theme.js";

export type SelectItem<T> = { description?: string; label: string; value: T };

const VISIBLE_ITEMS = 12;

export function Select<T>({ items, onSelect }: { items: SelectItem<T>[]; onSelect: (value: T) => void }) {
  const [highlighted, setHighlighted] = useState(0);

  useInput((input, key) => {
    if (key.upArrow || input === "k") setHighlighted((index) => (index - 1 + items.length) % items.length);
    if (key.downArrow || input === "j") setHighlighted((index) => (index + 1) % items.length);
    if (key.return && items[highlighted]) onSelect(items[highlighted].value);
  });

  const firstVisible = Math.min(Math.max(highlighted - VISIBLE_ITEMS + 1, 0), Math.max(items.length - VISIBLE_ITEMS, 0));
  const visibleItems = items.slice(firstVisible, firstVisible + VISIBLE_ITEMS);

  return (
    <Box flexDirection="column">
      {visibleItems.map((item, offset) => {
        const isHighlighted = firstVisible + offset === highlighted;
        return (
          <Text key={item.label} color={isHighlighted ? colors.brand : undefined} wrap="truncate-end">
            {isHighlighted ? "❯ " : "  "}
            {item.label}
            {item.description && <Text dimColor> {item.description}</Text>}
          </Text>
        );
      })}
      {items.length > VISIBLE_ITEMS && <Text dimColor>  {highlighted + 1}/{items.length}</Text>}
    </Box>
  );
}

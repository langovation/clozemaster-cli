import React, { useState } from "react";
import { Box, Text, useInput } from "ink";
import { cycledIndex } from "../cycle.js";
import { colors } from "../theme.js";
import { ListRow } from "./ListRow.js";

export type SelectItem<T> = { detail?: string; label: string; value: T };

const VISIBLE_ITEMS = 12;

export function Select<T>({ items, onSelect }: { items: SelectItem<T>[]; onSelect: (value: T) => void }) {
  const [highlighted, setHighlighted] = useState(0);

  useInput((input, key) => {
    if (key.upArrow || input === "k") setHighlighted((index) => cycledIndex(index, -1, items.length));
    if (key.downArrow || input === "j") setHighlighted((index) => cycledIndex(index, 1, items.length));
    if (key.return && items[highlighted]) onSelect(items[highlighted].value);
  });

  const firstVisible = firstVisibleIndex(highlighted, items.length);

  return (
    <Box flexDirection="column">
      {items.slice(firstVisible, firstVisible + VISIBLE_ITEMS).map((item, offset) => {
        const isHighlighted = firstVisible + offset === highlighted;
        return (
          <ListRow key={firstVisible + offset} isHighlighted={isHighlighted} label={item.label}>
            {item.detail ? <Text color={isHighlighted ? colors.brand : undefined} dimColor={!isHighlighted}>{item.detail}</Text> : undefined}
          </ListRow>
        );
      })}
      {items.length > VISIBLE_ITEMS && <Text dimColor>  {highlighted + 1}/{items.length}</Text>}
    </Box>
  );
}

function firstVisibleIndex(highlighted: number, itemCount: number): number {
  return Math.min(Math.max(highlighted - VISIBLE_ITEMS + 1, 0), Math.max(itemCount - VISIBLE_ITEMS, 0));
}

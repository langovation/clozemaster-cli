import React, { type ReactNode } from "react";
import { Box, Text } from "ink";
import { colors } from "../theme.js";

type ListRowProps = { children?: ReactNode; isHighlighted: boolean; label: string };

export function ListRow({ children, isHighlighted, label }: ListRowProps) {
  return (
    <Box justifyContent="space-between" gap={2}>
      <Text color={isHighlighted ? colors.brand : undefined} wrap="truncate-end">
        {isHighlighted ? "❯ " : "  "}
        {label}
      </Text>
      {children !== undefined && <Box flexShrink={0}>{children}</Box>}
    </Box>
  );
}

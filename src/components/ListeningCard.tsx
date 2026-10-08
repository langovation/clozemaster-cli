import React from "react";
import { Box, Text } from "ink";
import { colors } from "../theme.js";

export function ListeningCard() {
  return (
    <Box borderStyle="round" borderColor={colors.subtle} paddingX={1}>
      <Text color={colors.gold}>♪ Listen…</Text>
    </Box>
  );
}

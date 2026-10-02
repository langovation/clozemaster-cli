import React from "react";
import { Box, Text } from "ink";
import { LOGO } from "../sprites.js";
import { colors } from "../theme.js";
import { Buddy } from "./Buddy.js";
import { PixelArt } from "./PixelArt.js";

export function Welcome({ subtitle }: { subtitle: string }) {
  return (
    <Box flexDirection="column" gap={1}>
      <PixelArt sprite={LOGO} />
      <Box borderStyle="round" borderColor={colors.brand} paddingX={1} gap={2} alignItems="center">
        <Buddy />
        <Text>{subtitle}</Text>
      </Box>
    </Box>
  );
}

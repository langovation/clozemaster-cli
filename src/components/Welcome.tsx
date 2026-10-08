import React from "react";
import { Box, Text, useStdout } from "ink";
import { LOGO, SMALL_STACKED_LOGO, STACKED_LOGO } from "../sprites.js";
import { colors } from "../theme.js";
import { spriteWidth } from "../pixels.js";
import { PixelArt } from "./PixelArt.js";

const DEFAULT_TERMINAL_COLUMNS = 80;

export function logoForWidth(columns: number) {
  return [LOGO, STACKED_LOGO, SMALL_STACKED_LOGO].find((sprite) => spriteWidth(sprite) <= columns);
}

function Logo() {
  const { stdout } = useStdout();
  const logo = logoForWidth(stdout.columns || DEFAULT_TERMINAL_COLUMNS);
  if (!logo) return <Text bold color={colors.brand}>CLOZEMASTER</Text>;
  return <PixelArt sprite={logo} />;
}

export function Welcome({ subtitle }: { subtitle: string }) {
  return (
    <Box flexDirection="column">
      <Logo />
      <Text dimColor>{subtitle}</Text>
    </Box>
  );
}

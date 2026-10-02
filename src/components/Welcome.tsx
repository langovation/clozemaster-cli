import React from "react";
import { Box, Text, useStdout } from "ink";
import { LOGO, STACKED_LOGO } from "../sprites.js";
import { colors } from "../theme.js";
import { PixelArt } from "./PixelArt.js";
import { Robot } from "./Robot.js";

export function logoForWidth(columns: number) {
  return [LOGO, STACKED_LOGO].find((sprite) => Math.max(...sprite.rows.map((row) => row.length)) <= columns);
}

function Logo() {
  const { stdout } = useStdout();
  const logo = logoForWidth(stdout.columns || 80);
  if (!logo) return <Text bold color={colors.brand}>CLOZEMASTER</Text>;
  return <PixelArt sprite={logo} />;
}

export function Welcome({ subtitle }: { subtitle: string }) {
  return (
    <Box flexDirection="column">
      <Robot />
      <Logo />
      <Text dimColor>{subtitle}</Text>
    </Box>
  );
}

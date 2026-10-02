import React from "react";
import { Box, Text } from "ink";
import { renderSprite, type Sprite } from "../pixels.js";

// Never let the layout shrink a sprite: Ink would wrap it at its transparent cells.
export function PixelArt({ sprite }: { sprite: Sprite }) {
  return (
    <Box flexShrink={0}>
      <Text wrap="truncate-end">{renderSprite(sprite)}</Text>
    </Box>
  );
}

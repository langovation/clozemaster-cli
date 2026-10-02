import React from "react";
import { Text } from "ink";
import { renderSprite, type Sprite } from "../pixels.js";

export function PixelArt({ sprite }: { sprite: Sprite }) {
  return <Text>{renderSprite(sprite)}</Text>;
}

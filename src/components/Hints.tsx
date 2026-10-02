import React from "react";
import { Text } from "ink";

export function Hints({ hints }: { hints: string[] }) {
  return <Text dimColor>{hints.join(" · ")}</Text>;
}

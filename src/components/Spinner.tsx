import React, { useEffect, useState } from "react";
import { Text } from "ink";
import { colors } from "../theme.js";

const FRAMES = ["⠋", "⠙", "⠹", "⠸", "⠼", "⠴", "⠦", "⠧", "⠇", "⠏"];
const FRAME_INTERVAL_MS = 80;

export function Spinner({ label }: { label: string }) {
  const [frame, setFrame] = useState(0);
  useEffect(() => {
    const timer = setInterval(() => setFrame((current) => (current + 1) % FRAMES.length), FRAME_INTERVAL_MS);
    return () => clearInterval(timer);
  }, []);
  return (
    <Text>
      <Text color={colors.brand}>{FRAMES[frame]}</Text> {label}
    </Text>
  );
}

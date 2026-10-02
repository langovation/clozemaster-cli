import { colors } from "../src/theme.js";

export const ENTER = "\r";
export const DOWN = "\u001B[B";
export const UP = "\u001B[A";
export const ESCAPE = "\u001B";

export const settle = () => new Promise((resolve) => setTimeout(resolve, 30));

export async function press(stdin: { write: (input: string) => void }, ...keys: string[]) {
  for (const key of keys) {
    stdin.write(key);
    await settle();
  }
}

function rgb(hex: string) {
  const value = parseInt(hex.slice(1), 16);
  return `${(value >> 16) & 255};${(value >> 8) & 255};${value & 255}`;
}

// Whether the frame shows `text` in the given colour, ignoring any bold/reset codes around it.
export function showsInColor(frame: string, text: string, color: keyof typeof colors) {
  const escaped = text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return new RegExp(`38;2;${rgb(colors[color])}m(?:\\u001b\\[[0-9;]*m)*${escaped}`).test(frame);
}

export const stripAnsi = (frame: string) => frame.replace(/\u001b\[[0-9;]*m/g, "");

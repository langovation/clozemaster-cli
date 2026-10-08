export type Sprite = { palette: Record<string, string>; rows: string[] };

const TRANSPARENT = ".";

function hexToRgb(hex: string): string {
  const value = parseInt(hex.slice(1), 16);
  return `${(value >> 16) & 255};${(value >> 8) & 255};${value & 255}`;
}

function cell(top: string | undefined, bottom: string | undefined): string {
  if (!top && !bottom) return " ";
  if (top && !bottom) return `\x1b[38;2;${hexToRgb(top)}m▀\x1b[0m`;
  if (!top && bottom) return `\x1b[38;2;${hexToRgb(bottom)}m▄\x1b[0m`;
  return `\x1b[38;2;${hexToRgb(top!)};48;2;${hexToRgb(bottom!)}m▀\x1b[0m`;
}

export function spriteWidth({ rows }: Sprite): number {
  return Math.max(...rows.map((row) => row.length));
}

// Two pixel rows per terminal line using half blocks, so pixels come out square.
export function renderSprite(sprite: Sprite): string {
  const { palette, rows } = sprite;
  const width = spriteWidth(sprite);
  const colorAt = (y: number, x: number) => {
    const key = rows[y]?.[x];
    return key && key !== TRANSPARENT ? palette[key] : undefined;
  };
  const lines: string[] = [];
  for (let y = 0; y < rows.length; y += 2) {
    let line = "";
    for (let x = 0; x < width; x++) line += cell(colorAt(y, x), colorAt(y + 1, x));
    lines.push(line.replace(/ +$/, ""));
  }
  return lines.join("\n");
}

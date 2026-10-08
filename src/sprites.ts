import type { Sprite } from "./pixels.js";

type Glyphs = Record<string, string[]>;

const LARGE_GLYPHS: Glyphs = {
  A: [".###.", "#...#", "#...#", "#####", "#...#", "#...#", "#...#"],
  C: [".###.", "#...#", "#....", "#....", "#....", "#...#", ".###."],
  E: ["#####", "#....", "#....", "####.", "#....", "#....", "#####"],
  L: ["#....", "#....", "#....", "#....", "#....", "#....", "#####"],
  M: ["#...#", "##.##", "#.#.#", "#.#.#", "#...#", "#...#", "#...#"],
  O: [".###.", "#...#", "#...#", "#...#", "#...#", "#...#", ".###."],
  R: ["####.", "#...#", "#...#", "####.", "#.#..", "#..#.", "#...#"],
  S: [".####", "#....", "#....", ".###.", "....#", "....#", "####."],
  T: ["#####", "..#..", "..#..", "..#..", "..#..", "..#..", "..#.."],
  Z: ["#####", "....#", "...#.", "..#..", ".#...", "#....", "#####"],
};

const SMALL_GLYPHS: Glyphs = {
  A: [".#.", "#.#", "###", "#.#", "#.#"],
  C: [".##", "#..", "#..", "#..", ".##"],
  E: ["###", "#..", "##.", "#..", "###"],
  L: ["#..", "#..", "#..", "#..", "###"],
  M: ["#.#", "###", "###", "#.#", "#.#"],
  O: [".#.", "#.#", "#.#", "#.#", ".#."],
  R: ["##.", "#.#", "##.", "#.#", "#.#"],
  S: [".##", "#..", ".#.", "..#", "##."],
  T: ["###", ".#.", ".#.", ".#.", ".#."],
  Z: ["###", "..#", ".#.", "#..", "###"],
};

// Each glyph row gets a shade from light to dark, plus a drop shadow, arcade style.
const ROW_SHADES = ["1", "2", "3", "4", "5", "6", "7"];
const SHADOW = "s";
const EMPTY = ".";
const LIT = "#";

function pixelText(text: string, glyphs: Glyphs): string[] {
  const height = glyphs.A.length;
  const advance = glyphs.A[0].length + 1;
  const grid = Array.from({ length: height + 1 }, () => Array(text.length * advance + 1).fill(EMPTY));
  [...text].forEach((letter, index) => {
    glyphs[letter].forEach((glyphRow, y) => {
      [...glyphRow].forEach((pixel, x) => {
        if (pixel !== LIT) return;
        const column = index * advance + x;
        grid[y][column] = shadeForRow(y, height);
        if (grid[y + 1][column + 1] === EMPTY) grid[y + 1][column + 1] = SHADOW;
      });
    });
  });
  return grid.map((row) => row.join(""));
}

function shadeForRow(y: number, height: number): string {
  return ROW_SHADES[Math.round((y * (ROW_SHADES.length - 1)) / (height - 1))];
}

const LOGO_PALETTE = {
  "1": "#C8F2C8",
  "2": "#A3E8A3",
  "3": "#86D886",
  "4": "#6CC66C",
  "5": "#5CB85C",
  "6": "#47A047",
  "7": "#368836",
  s: "#1E4A1E",
};

export const LOGO: Sprite = { palette: LOGO_PALETTE, rows: pixelText("CLOZEMASTER", LARGE_GLYPHS) };

// For narrow terminals: CLOZE stacked over MASTER.
export const STACKED_LOGO: Sprite = {
  palette: LOGO_PALETTE,
  rows: [...pixelText("CLOZE", LARGE_GLYPHS), ...pixelText("MASTER", LARGE_GLYPHS)],
};

// For very narrow terminals: the same, in a 3x5 font.
export const SMALL_STACKED_LOGO: Sprite = {
  palette: LOGO_PALETTE,
  rows: [...pixelText("CLOZE", SMALL_GLYPHS), ...pixelText("MASTER", SMALL_GLYPHS)],
};

export const TROPHY: Sprite = {
  palette: { B: "#6B4A1F", D: "#A8792A", L: "#F5D78E", Y: "#D9A441" },
  rows: [
    "..LLYYYYYYDD..",
    "YYLYYYYYYYYDYY",
    "Y.LYYYYYYYYD.Y",
    "Y.LYYYYYYYYD.Y",
    ".YLYYYYYYYYDY.",
    "..LYYYYYYYYD..",
    "...LYYYYYYD...",
    "....YYYYYD....",
    ".....YYYD.....",
    "......YD......",
    "....BBBBBB....",
    "...BBBBBBBB...",
  ],
};

export const FLAME: Sprite = {
  palette: { O: "#FF6600", R: "#D4403A", Y: "#F0AD4E" },
  rows: [
    "...R...",
    "..RR...",
    "..RRR..",
    ".RROR..",
    ".ROORR.",
    "RROYORR",
    "ROYYYOR",
    ".RYYYR.",
  ],
};

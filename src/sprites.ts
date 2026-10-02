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

// Each glyph row gets a shade from light to dark, plus a drop shadow, arcade style.
const ROW_SHADES = ["1", "2", "3", "4", "5", "6", "7"];

function pixelText(text: string, glyphs: Glyphs): string[] {
  const height = glyphs.A.length;
  const advance = glyphs.A[0].length + 1;
  const grid = Array.from({ length: height + 1 }, () => Array(text.length * advance + 1).fill("."));
  [...text].forEach((letter, index) => {
    glyphs[letter].forEach((glyphRow, y) => {
      [...glyphRow].forEach((pixel, x) => {
        if (pixel !== "#") return;
        const column = index * advance + x;
        grid[y][column] = ROW_SHADES[Math.round((y * (ROW_SHADES.length - 1)) / (height - 1))];
        if (grid[y + 1][column + 1] === ".") grid[y + 1][column + 1] = "s";
      });
    });
  });
  return grid.map((row) => row.join(""));
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

export const CHECK: Sprite = {
  palette: { G: "#5CB85C", g: "#2F822F" },
  rows: [
    ".........GG",
    "........GGg",
    "GG.....GGg.",
    "gGG...GGg..",
    ".gGG.GGg...",
    "..gGGGg....",
    "...gGg.....",
    "....g......",
  ],
};

export const CROSS: Sprite = {
  palette: { R: "#D9534F", r: "#A11E1A" },
  rows: [
    "RR....RR",
    "RRR..RRr",
    ".RRRRRr.",
    "..RRRr..",
    ".RRRRRR.",
    "RRRr.RRR",
    "RRr...RR",
    ".r.....r",
  ],
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

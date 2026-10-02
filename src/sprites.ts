import type { Sprite } from "./pixels.js";

const GLYPHS: Record<string, string[]> = {
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

// Each glyph row gets its own shade (light to dark) and a drop shadow, arcade style.
const ROW_SHADES = ["1", "2", "3", "4", "5", "6", "7"];

function pixelText(text: string): string[] {
  const height = 7;
  const width = text.length * 6;
  const grid = Array.from({ length: height + 1 }, () => Array(width + 1).fill("."));
  [...text].forEach((letter, index) => {
    GLYPHS[letter].forEach((glyphRow, y) => {
      [...glyphRow].forEach((pixel, x) => {
        if (pixel !== "#") return;
        const column = index * 6 + x;
        grid[y][column] = ROW_SHADES[y];
        if (grid[y + 1][column + 1] === ".") grid[y + 1][column + 1] = "s";
      });
    });
  });
  return grid.map((row) => row.join(""));
}

export const LOGO: Sprite = {
  palette: {
    "1": "#C8F2C8",
    "2": "#A3E8A3",
    "3": "#86D886",
    "4": "#6CC66C",
    "5": "#5CB85C",
    "6": "#47A047",
    "7": "#368836",
    s: "#1E4A1E",
  },
  rows: pixelText("CLOZEMASTER"),
};

const BUDDY_PALETTE = { G: "#5CB85C", K: "#1D1D1D", W: "#F2F2F2", w: "#BDBDBD" };

// A speech bubble with a cloze blank for a mouth.
export const BUDDY: Sprite = {
  palette: BUDDY_PALETTE,
  rows: [
    "..WWWWWWWWWW..",
    ".WWWWWWWWWWWW.",
    "WWWKKWWWWKKWWW",
    "WWWKKWWWWKKWWW",
    "WWWWWWWWWWWWWW",
    "WWWGGGGGGGGWWw",
    ".WWWWWWWWWWWw.",
    "..WWWWWWWWww..",
    "...WWW........",
    "...WW.........",
  ],
};

export const BUDDY_BLINKING: Sprite = {
  palette: BUDDY_PALETTE,
  rows: BUDDY.rows.map((row, y) => (y === 2 ? row.replace(/K/g, "W") : row)),
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

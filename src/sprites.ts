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

const ROBOT_PALETTE = { A: "#D9A441", a: "#FF6600", d: "#7C7C7C", e: "#5CB85C", g: "#D6D6D6", k: "#1D1D1D" };

const ROBOT_ROWS = [
  "......AA......",
  "......dd......",
  "..gggggggggg..",
  ".gkkkkkkkkkkg.",
  ".gkeekkkkeekg.",
  ".gkeekkkkeekg.",
  ".gkkkkkkkkkkg.",
  "..gggggggggg..",
  ".....dddd.....",
  "dggggggggggggd",
  "d.gggggggggg.d",
  "..gg......gg..",
  "..dd......dd..",
];

const BLANK_ROW = ".".repeat(ROBOT_ROWS[0].length);

// The robot bobs a pixel up and down, its antenna flickers and it blinks now and then.
export const ROBOT_FRAMES: Sprite[] = [
  { palette: ROBOT_PALETTE, rows: [BLANK_ROW, ...ROBOT_ROWS] },
  { palette: { ...ROBOT_PALETTE, A: ROBOT_PALETTE.a }, rows: [...ROBOT_ROWS, BLANK_ROW] },
  { palette: ROBOT_PALETTE, rows: [BLANK_ROW, ...ROBOT_ROWS] },
  { palette: { ...ROBOT_PALETTE, A: ROBOT_PALETTE.a }, rows: [...ROBOT_ROWS, BLANK_ROW] },
  { palette: { ...ROBOT_PALETTE, e: ROBOT_PALETTE.k }, rows: [BLANK_ROW, ...ROBOT_ROWS] },
];

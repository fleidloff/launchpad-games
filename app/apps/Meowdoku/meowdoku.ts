import type { App, RGB } from "../../types";
import type { NoteMessageEvent, ControlChangeMessageEvent } from "webmidi";
import { setRGB, setRGBFlashing, clearGrid } from "../../core/grid";

type Coord = [number, number];
type Grid = number[][];
type Constraints = {
  regions: Grid;
  row: number;
  usedCols: Set<number>;
  usedRegions: Set<number>;
  prevCol: number;
};
type Search = Constraints & { placed: Coord[] };

const N = 8;
const HEARTS_START = 3;
const MAX_ATTEMPTS = 300;
const MISTAKE_FLASH_MS = 250;
const MISTAKE_REVERT_MS = 450;
const WIN_FLASH_MS = 700;
const FAIL_FLASH_MS = 300;
const NEW_GAME_PAD = 98;
const HEART_PADS = [91, 92, 93];

const RANGE_N = Array.from({ length: N }, (_unused, i) => i);
const ALL_COORDS: Coord[] = Array.from({ length: N * N }, (_unused, i): Coord => [
  Math.floor(i / N),
  i % N,
]);
const ORTHO: Coord[] = [
  [-1, 0],
  [1, 0],
  [0, -1],
  [0, 1],
];
const DIAG8: Coord[] = [
  [-1, -1],
  [-1, 0],
  [-1, 1],
  [0, -1],
  [0, 1],
  [1, -1],
  [1, 0],
  [1, 1],
];

const REGION_COLORS: RGB[] = [
  [127, 0, 0],
  [127, 55, 0],
  [110, 95, 0],
  [0, 110, 25],
  [0, 95, 95],
  [0, 35, 120],
  [70, 0, 120],
  [120, 0, 70],
];
const CAT_RGB: RGB = [127, 127, 127];
const EMPTY_RGB: RGB = [0, 0, 0];
const MISTAKE_RGB: RGB = [127, 0, 0];
const WIN_RGB: RGB = [0, 127, 0];
const FAIL_RGB: RGB = [127, 0, 0];
const HEART_RGB: RGB = [127, 0, 0];
const HEART_OFF_RGB: RGB = [14, 0, 0];
const NEW_GAME_RGB: RGB = [0, 70, 70];
const BLOCK_PAD = 97;
const BLOCK_ON_RGB: RGB = [90, 90, 90];
const BLOCK_OFF_RGB: RGB = [12, 12, 12];
const BLOCKED_RGB: RGB = [0, 0, 0];

export let regions: Grid = [];
export let cats: boolean[][] = [];
export let catCount = 0;
export let hearts = HEARTS_START;
export let solved = false;
export let failed = false;
export let showBlocked = false;
let mistakeTimer: ReturnType<typeof setTimeout> | null = null;

function shuffle<T>(items: readonly T[]): T[] {
  const result = [...items];
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    const a = result[i];
    const b = result[j];
    if (a !== undefined && b !== undefined) {
      result[i] = b;
      result[j] = a;
    }
  }
  return result;
}

function regionOf(grid: Grid, coord: Coord): number {
  return grid[coord[0]]?.[coord[1]] ?? -1;
}

function setRegion(grid: Grid, move: { coord: Coord; value: number }): void {
  const row = grid[move.coord[0]];
  if (row) row[move.coord[1]] = move.value;
}

function makeEmptyRegions(): Grid {
  return Array.from({ length: N }, () => Array.from({ length: N }, () => -1));
}

function canPlaceCol(cols: number[], pos: { row: number; col: number }): boolean {
  if (cols.includes(pos.col)) return false;
  if (pos.row === 0) return true;
  const prev = cols[pos.row - 1];
  return prev === undefined || Math.abs(pos.col - prev) >= 2;
}

function placeRow(cols: number[], row: number): boolean {
  if (row === N) return true;
  for (const col of shuffle(RANGE_N)) {
    if (!canPlaceCol(cols, { row, col })) continue;
    cols[row] = col;
    if (placeRow(cols, row + 1)) return true;
    cols[row] = -1;
  }
  return false;
}

function buildSolutionColumns(): number[] | null {
  const cols = Array.from({ length: N }, () => -1);
  return placeRow(cols, 0) ? cols : null;
}

function seedRegions(grid: Grid, cols: number[]): void {
  for (let r = 0; r < N; r++) {
    const c = cols[r];
    if (c !== undefined) setRegion(grid, { coord: [r, c], value: r });
  }
}

function adjacentRegions(grid: Grid, coord: Coord): number[] {
  const found = new Set<number>();
  for (const [dr, dc] of ORTHO) {
    const region = regionOf(grid, [coord[0] + dr, coord[1] + dc]);
    if (region !== -1) found.add(region);
  }
  return [...found];
}

function growthOptions(grid: Grid): { coord: Coord; region: number }[] {
  const result: { coord: Coord; region: number }[] = [];
  for (const coord of ALL_COORDS) {
    if (regionOf(grid, coord) !== -1) continue;
    for (const region of adjacentRegions(grid, coord)) {
      result.push({ coord, region });
    }
  }
  return result;
}

function pickGrowthOption(grid: Grid): { coord: Coord; region: number } | null {
  const options = growthOptions(grid);
  const index = Math.floor(Math.random() * options.length);
  return options[index] ?? null;
}

function fillRegions(grid: Grid): void {
  let remaining = ALL_COORDS.filter((coord) => regionOf(grid, coord) === -1).length;
  while (remaining > 0) {
    const option = pickGrowthOption(grid);
    if (!option) break;
    setRegion(grid, { coord: option.coord, value: option.region });
    remaining--;
  }
}

function generateRegions(): Grid | null {
  const cols = buildSolutionColumns();
  if (!cols) return null;
  const grid = makeEmptyRegions();
  seedRegions(grid, cols);
  fillRegions(grid);
  return grid;
}

function canPlace(ctx: Constraints, col: number): boolean {
  if (ctx.usedCols.has(col)) return false;
  const region = regionOf(ctx.regions, [ctx.row, col]);
  if (ctx.usedRegions.has(region)) return false;
  if (ctx.prevCol >= 0 && Math.abs(col - ctx.prevCol) < 2) return false;
  return true;
}

function nextConstraints(ctx: Constraints, col: number): Constraints {
  const region = regionOf(ctx.regions, [ctx.row, col]);
  return {
    regions: ctx.regions,
    row: ctx.row + 1,
    usedCols: new Set(ctx.usedCols).add(col),
    usedRegions: new Set(ctx.usedRegions).add(region),
    prevCol: col,
  };
}

function countFromRow(ctx: Constraints): number {
  if (ctx.row === N) return 1;
  let total = 0;
  for (let col = 0; col < N; col++) {
    if (!canPlace(ctx, col)) continue;
    total += countFromRow(nextConstraints(ctx, col));
    if (total > 1) break;
  }
  return total;
}

function initialConstraints(grid: Grid): Constraints {
  return {
    regions: grid,
    row: 0,
    usedCols: new Set(),
    usedRegions: new Set(),
    prevCol: -1,
  };
}

export function countSolutions(grid: Grid): number {
  return countFromRow(initialConstraints(grid));
}

function advanceSearch(ctx: Search, col: number): Search {
  const base = nextConstraints(ctx, col);
  return { ...base, placed: [...ctx.placed, [ctx.row, col]] };
}

function searchSolution(ctx: Search): Coord[] | null {
  if (ctx.row === N) return ctx.placed;
  for (let col = 0; col < N; col++) {
    if (!canPlace(ctx, col)) continue;
    const result = searchSolution(advanceSearch(ctx, col));
    if (result) return result;
  }
  return null;
}

export function findSolution(grid: Grid): Coord[] | null {
  return searchSolution({ ...initialConstraints(grid), placed: [] });
}

export function generatePuzzle(): Grid {
  let last = generateRegions();
  for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
    const grid = generateRegions();
    if (!grid) continue;
    last = grid;
    if (countSolutions(grid) === 1) return grid;
  }
  return last ?? makeEmptyRegions();
}

function makeCatGrid(): boolean[][] {
  return Array.from({ length: N }, () => Array.from({ length: N }, () => false));
}

function catHere(coord: Coord): boolean {
  return cats[coord[0]]?.[coord[1]] === true;
}

function setCat(coord: Coord, value: boolean): void {
  const row = cats[coord[0]];
  if (row) row[coord[1]] = value;
}

function gridPadId(coord: Coord): number {
  return (N - coord[0]) * 10 + (coord[1] + 1);
}

function padToCoord(pad: number): Coord | null {
  const padRow = Math.floor(pad / 10);
  const padCol = pad % 10;
  if (padRow < 1 || padRow > N || padCol < 1 || padCol > N) return null;
  return [N - padRow, padCol - 1];
}

function cellRGB(coord: Coord): RGB {
  if (catHere(coord)) return CAT_RGB;
  if (showBlocked && violatesRules(coord)) return BLOCKED_RGB;
  return REGION_COLORS[regionOf(regions, coord)] ?? EMPTY_RGB;
}

function drawCell(coord: Coord): void {
  setRGB(gridPadId(coord), cellRGB(coord));
}

function drawBoard(): void {
  for (const coord of ALL_COORDS) {
    drawCell(coord);
  }
}

function drawHearts(): void {
  HEART_PADS.forEach((pad, index) => {
    setRGB(pad, index < hearts ? HEART_RGB : HEART_OFF_RGB);
  });
}

function drawBlockButton(): void {
  setRGB(BLOCK_PAD, showBlocked ? BLOCK_ON_RGB : BLOCK_OFF_RGB);
}

function refreshCell(coord: Coord): void {
  if (showBlocked) {
    drawBoard();
  } else {
    drawCell(coord);
  }
}

function clearMistakeTimer(): void {
  if (mistakeTimer !== null) {
    clearTimeout(mistakeTimer);
    mistakeTimer = null;
  }
}

export function newGame(): void {
  clearMistakeTimer();
  regions = generatePuzzle();
  cats = makeCatGrid();
  catCount = 0;
  hearts = HEARTS_START;
  solved = false;
  failed = false;
  showBlocked = false;
  clearGrid();
  drawHearts();
  drawBlockButton();
  setRGB(NEW_GAME_PAD, NEW_GAME_RGB);
  drawBoard();
}

function rowHasCat(row: number): boolean {
  return RANGE_N.some((col) => catHere([row, col]));
}

function colHasCat(col: number): boolean {
  return RANGE_N.some((row) => catHere([row, col]));
}

function regionHasCat(coord: Coord): boolean {
  const region = regionOf(regions, coord);
  return ALL_COORDS.some(
    (other) => catHere(other) && regionOf(regions, other) === region
  );
}

function adjacentToCat(coord: Coord): boolean {
  return DIAG8.some(([dr, dc]) => catHere([coord[0] + dr, coord[1] + dc]));
}

function violatesRules(coord: Coord): boolean {
  return (
    rowHasCat(coord[0]) ||
    colHasCat(coord[1]) ||
    regionHasCat(coord) ||
    adjacentToCat(coord)
  );
}

export function isBlocked(coord: Coord): boolean {
  return !catHere(coord) && violatesRules(coord);
}

export function toggleBlocked(): void {
  showBlocked = !showBlocked;
  drawBlockButton();
  drawBoard();
}

function winLevel(): void {
  solved = true;
  clearMistakeTimer();
  for (const coord of ALL_COORDS) {
    if (catHere(coord)) {
      setRGBFlashing(gridPadId(coord), { rgb: WIN_RGB, duration: WIN_FLASH_MS });
    }
  }
}

function failLevel(): void {
  failed = true;
  clearMistakeTimer();
  for (const coord of ALL_COORDS) {
    setRGBFlashing(gridPadId(coord), { rgb: FAIL_RGB, duration: FAIL_FLASH_MS });
  }
}

function flashMistake(coord: Coord): void {
  setRGBFlashing(gridPadId(coord), { rgb: MISTAKE_RGB, duration: MISTAKE_FLASH_MS });
  clearMistakeTimer();
  mistakeTimer = setTimeout(() => {
    mistakeTimer = null;
    drawCell(coord);
  }, MISTAKE_REVERT_MS);
}

function registerMistake(coord: Coord): void {
  hearts--;
  drawHearts();
  flashMistake(coord);
  if (hearts <= 0) failLevel();
}

function tryPlaceCat(coord: Coord): void {
  if (violatesRules(coord)) {
    registerMistake(coord);
    return;
  }
  setCat(coord, true);
  catCount++;
  refreshCell(coord);
  if (catCount === N) winLevel();
}

function removeCat(coord: Coord): void {
  setCat(coord, false);
  catCount--;
  refreshCell(coord);
}

export function tapCell(coord: Coord): void {
  if (catHere(coord)) {
    removeCat(coord);
    return;
  }
  tryPlaceCat(coord);
}

function handleGrid(pad: number): void {
  if (solved || failed) {
    newGame();
    return;
  }
  const coord = padToCoord(pad);
  if (!coord) return;
  tapCell(coord);
}

function handleControl(controller: number): void {
  if (controller === NEW_GAME_PAD) newGame();
  else if (controller === BLOCK_PAD) toggleBlocked();
}

export const meowdoku: App = {
  name: "Meowdoku",

  init(): void {
    newGame();
  },

  cleanup(): void {
    clearMistakeTimer();
  },

  onNoteOn(e: NoteMessageEvent): void {
    handleGrid(e.note.number);
  },

  onControlChange(e: ControlChangeMessageEvent): void {
    const velocity = e.message.data[2] ?? 0;
    if (velocity > 0) handleControl(e.controller.number);
  },
};

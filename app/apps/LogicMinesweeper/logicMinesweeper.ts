import { clearGrid, setRGB, setRGBFlashing } from "../../core/grid";
import type { App, RGB } from "../../types";
import type { NoteMessageEvent, ControlChangeMessageEvent } from "webmidi";

export type BoardCell = {
  isMine: boolean;
  count: number;
  revealed: boolean;
  flagged: boolean;
};

type Coord = [number, number];
type Grid = BoardCell[][];

const ROWS = 8;
const COLS = 8;
const MINES_COUNT = 10;
const TOGGLE_BUTTON_PAD = 99;
const MAX_GENERATION_ATTEMPTS = 1000;

const FLAG_RGB: RGB = [0, 0, 127];
const HIDDEN_RGB: RGB = [15, 15, 15];
const REVEAL_MODE_RGB: RGB = [0, 80, 0];
const FLAG_MODE_RGB: RGB = [0, 0, 80];
const TRIGGERED_MINE_RGB: RGB = [127, 0, 0];
const HIGH_COUNT_RGB: RGB = [120, 0, 120];
const WIN_RGB: RGB = [0, 127, 0];

const COUNT_COLORS: Record<number, RGB> = {
  0: [0, 0, 0],
  1: [0, 60, 0],
  2: [100, 100, 0],
  3: [127, 40, 0],
};

const NEIGHBOR_OFFSETS: Coord[] = [
  [-1, -1], [-1, 0], [-1, 1],
  [0, -1], [0, 1],
  [1, -1], [1, 0], [1, 1],
];

const ALL_COORDS: Coord[] = Array.from({ length: ROWS * COLS }, (_unused, i): Coord => [
  Math.floor(i / COLS),
  i % COLS,
]);

export let board: Grid = [];
export let isGenerated = false;
export let isGameOver = false;
export let isGameWon = false;
export let playMode: "reveal" | "flag" = "reveal";

function inBounds(r: number, c: number): boolean {
  return r >= 0 && r < ROWS && c >= 0 && c < COLS;
}

function at(grid: Grid, [r, c]: Coord): BoardCell | undefined {
  return grid[r]?.[c];
}

function padIdOf(r: number, c: number): number {
  return (r + 1) * 10 + (c + 1);
}

function getNeighbors(r: number, c: number): Coord[] {
  return NEIGHBOR_OFFSETS
    .map(([dr, dc]): Coord => [r + dr, c + dc])
    .filter(([nr, nc]) => inBounds(nr, nc));
}

function eachCell(grid: Grid, visit: (cell: BoardCell, coord: Coord) => void): void {
  for (let r = 0; r < ROWS; r++) {
    const row = grid[r];
    if (!row) continue;
    for (let c = 0; c < COLS; c++) {
      const cell = row[c];
      if (cell) visit(cell, [r, c]);
    }
  }
}

function createEmptyBoard(): Grid {
  return Array.from({ length: ROWS }, () =>
    Array.from({ length: COLS }, () => ({
      isMine: false,
      count: 0,
      revealed: false,
      flagged: false,
    }))
  );
}

function isGameFinished(): boolean {
  return isGameOver || isGameWon;
}

export function resetGame(): void {
  isGenerated = false;
  isGameOver = false;
  isGameWon = false;
  playMode = "reveal";

  board = createEmptyBoard();

  clearGrid();
  drawToggleModeButton();
  drawBoard();
}

function drawToggleModeButton(): void {
  setRGB(TOGGLE_BUTTON_PAD, playMode === "reveal" ? REVEAL_MODE_RGB : FLAG_MODE_RGB);
}

function drawRevealedCell(cell: BoardCell, padId: number): void {
  if (cell.isMine) {
    setRGBFlashing(padId, { rgb: TRIGGERED_MINE_RGB, duration: 300 });
    return;
  }
  const color = COUNT_COLORS[cell.count];
  if (color) {
    setRGB(padId, color);
  } else {
    setRGBFlashing(padId, { rgb: HIGH_COUNT_RGB, duration: 1000 });
  }
}

function drawCell(cell: BoardCell, padId: number): void {
  if (cell.revealed) {
    drawRevealedCell(cell, padId);
  } else if (cell.flagged) {
    setRGB(padId, FLAG_RGB);
  } else {
    setRGB(padId, HIDDEN_RGB);
  }
}

function drawBoard(): void {
  eachCell(board, (cell, [r, c]) => drawCell(cell, padIdOf(r, c)));
}

function resetCells(): void {
  eachCell(board, (cell) => {
    cell.isMine = false;
    cell.count = 0;
    cell.revealed = false;
    cell.flagged = false;
  });
}

function safeSpotsExcluding(startR: number, startC: number): Coord[] {
  const forbidden = getNeighbors(startR, startC);
  forbidden.push([startR, startC]);
  const isForbidden = (r: number, c: number) =>
    forbidden.some(([fr, fc]) => fr === r && fc === c);
  return ALL_COORDS.filter(([r, c]) => !isForbidden(r, c));
}

function shuffle(items: Coord[]): Coord[] {
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

function placeMinesAvoiding(startR: number, startC: number): void {
  resetCells();
  const spots = shuffle(safeSpotsExcluding(startR, startC));
  for (const spot of spots.slice(0, MINES_COUNT)) {
    const cell = at(board, spot);
    if (cell) cell.isMine = true;
  }
}

function countAdjacentMines(grid: Grid, [r, c]: Coord): number {
  return getNeighbors(r, c).filter((coord) => at(grid, coord)?.isMine).length;
}

function assignAdjacentCounts(): void {
  eachCell(board, (cell, coord) => {
    if (!cell.isMine) cell.count = countAdjacentMines(board, coord);
  });
}

function generateNoGuessBoard(startR: number, startC: number): void {
  for (let attempt = 0; attempt < MAX_GENERATION_ATTEMPTS; attempt++) {
    placeMinesAvoiding(startR, startC);
    assignAdjacentCounts();
    if (isSolvable(startR, startC)) {
      isGenerated = true;
      return;
    }
  }

  console.warn("[LogicMinesweeper] Max generation attempts reached, using fallback.");
  isGenerated = true;
}

function cloneForSolver(grid: Grid): Grid {
  return grid.map((row) =>
    row.map((cell) => ({
      isMine: cell.isMine,
      count: cell.count,
      revealed: false,
      flagged: false,
    }))
  );
}

function canReveal(cell: BoardCell | undefined): cell is BoardCell {
  return cell !== undefined && !cell.revealed && !cell.flagged;
}

function revealInSolver(solved: Grid, coord: Coord): void {
  const [r, c] = coord;
  const cell = at(solved, coord);
  if (!canReveal(cell)) return;

  cell.revealed = true;
  if (cell.count !== 0) return;
  for (const next of getNeighbors(r, c)) {
    revealInSolver(solved, next);
  }
}

function flagInSolver(solved: Grid, coord: Coord): void {
  const cell = at(solved, coord);
  if (cell && !cell.flagged) cell.flagged = true;
}

function isActiveClue(cell: BoardCell | undefined): cell is BoardCell {
  return cell !== undefined && cell.revealed && cell.count > 0;
}

type NeighborStatus = { flaggedCount: number; unrevealed: Coord[] };

function neighborStatus(solved: Grid, [r, c]: Coord): NeighborStatus {
  let flaggedCount = 0;
  const unrevealed: Coord[] = [];
  for (const [nr, nc] of getNeighbors(r, c)) {
    const nCell = at(solved, [nr, nc]);
    if (!nCell) continue;
    if (nCell.flagged) flaggedCount++;
    else if (!nCell.revealed) unrevealed.push([nr, nc]);
  }
  return { flaggedCount, unrevealed };
}

type ClueContext = { count: number; flaggedCount: number; unrevealed: Coord[] };

function applyRules(solved: Grid, ctx: ClueContext): boolean {
  if (ctx.flaggedCount === ctx.count) {
    ctx.unrevealed.forEach((coord) => revealInSolver(solved, coord));
    return true;
  }
  if (ctx.flaggedCount + ctx.unrevealed.length === ctx.count) {
    ctx.unrevealed.forEach((coord) => flagInSolver(solved, coord));
    return true;
  }
  return false;
}

function deduceAtCell(solved: Grid, coord: Coord): boolean {
  const cell = at(solved, coord);
  if (!isActiveClue(cell)) return false;

  const { flaggedCount, unrevealed } = neighborStatus(solved, coord);
  if (unrevealed.length === 0) return false;

  return applyRules(solved, { count: cell.count, flaggedCount, unrevealed });
}

function applySolverDeductions(solved: Grid): boolean {
  let progress = false;
  for (const coord of ALL_COORDS) {
    if (deduceAtCell(solved, coord)) progress = true;
  }
  return progress;
}

function allSafeRevealed(solved: Grid): boolean {
  return ALL_COORDS.every((coord) => {
    const cell = at(solved, coord);
    return !cell || cell.isMine || cell.revealed;
  });
}

function isSolvable(startR: number, startC: number): boolean {
  const solved = cloneForSolver(board);
  revealInSolver(solved, [startR, startC]);

  let progressed = true;
  while (progressed) {
    progressed = applySolverDeductions(solved);
  }

  return allSafeRevealed(solved);
}

function revealCell(r: number, c: number): void {
  const cell = at(board, [r, c]);
  if (!canReveal(cell)) return;

  cell.revealed = true;

  if (cell.isMine) {
    handleGameOver();
    return;
  }

  if (cell.count === 0) {
    for (const [nr, nc] of getNeighbors(r, c)) {
      revealCell(nr, nc);
    }
  }

  checkWinCondition();
}

function checkWinCondition(): void {
  const safeHidden = ALL_COORDS.some((coord) => {
    const cell = at(board, coord);
    return cell !== undefined && !cell.isMine && !cell.revealed;
  });

  if (!safeHidden) handleWin();
}

function handleGameOver(): void {
  isGameOver = true;
  eachCell(board, (cell) => {
    if (cell.isMine) cell.revealed = true;
  });
  drawBoard();
}

function handleWin(): void {
  isGameWon = true;
  for (const [r, c] of ALL_COORDS) {
    setRGBFlashing(padIdOf(r, c), { rgb: WIN_RGB, duration: 1000 });
  }
}

function padToCoord(padId: number): Coord | null {
  const r = Math.floor(padId / 10) - 1;
  const c = (padId % 10) - 1;
  return inBounds(r, c) ? [r, c] : null;
}

function ensureBoardForShortPress([r, c]: Coord): boolean {
  if (isGenerated) return true;
  if (playMode === "flag") return false;
  generateNoGuessBoard(r, c);
  return true;
}

function revealInPlay([r, c]: Coord, cell: BoardCell): void {
  if (cell.flagged) return;
  revealCell(r, c);
  if (!isGameFinished()) drawBoard();
}

function toggleFlagInPlay(cell: BoardCell): void {
  if (cell.revealed) return;
  cell.flagged = !cell.flagged;
  drawBoard();
}

function applyShortPressAction(coord: Coord): void {
  const cell = at(board, coord);
  if (!cell) return;
  if (playMode === "reveal") {
    revealInPlay(coord, cell);
  } else {
    toggleFlagInPlay(cell);
  }
}

export function handleGridShortPress(padId: number): void {
  if (isGameFinished()) {
    resetGame();
    return;
  }

  const coord = padToCoord(padId);
  if (!coord) return;

  if (!ensureBoardForShortPress(coord)) return;

  applyShortPressAction(coord);
}

export function handleGridLongPress(padId: number): void {
  if (isGameFinished()) {
    resetGame();
    return;
  }

  const coord = padToCoord(padId);
  if (!coord) return;

  if (!isGenerated) generateNoGuessBoard(coord[0], coord[1]);

  const cell = at(board, coord);
  if (!cell) return;
  toggleFlagInPlay(cell);
}

export function handleGridPress(padId: number): void {
  handleGridShortPress(padId);
}

export function togglePlayMode(): void {
  playMode = playMode === "reveal" ? "flag" : "reveal";
  drawToggleModeButton();
}

export const logicMinesweeperApp: App = {
  name: "Logic Minesweeper",

  init(): void {
    resetGame();
  },

  onNoteOn(e: NoteMessageEvent): void {
    handleGridShortPress(e.note.number);
  },

  onNoteOnLongPress(e: NoteMessageEvent): void {
    handleGridLongPress(e.note.number);
  },

  onControlChange(e: ControlChangeMessageEvent): void {
    const velocity = e.message.data[2] ?? 0;
    if (velocity > 0 && e.controller.number === TOGGLE_BUTTON_PAD) {
      togglePlayMode();
    }
  }
};

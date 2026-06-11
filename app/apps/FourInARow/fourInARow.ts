import { clearGrid, setRGB, setRGBFlashing } from "../../core/grid";
import type { App } from "../../types";
import type { ControlChangeMessageEvent, NoteMessageEvent } from "webmidi";

export type Player = 1 | 2;
export type Cell = Player | 0;

const ROWS = 8;
const COLS = 8;
const FALL_SPEED_MS_PER_ROW = 100;

export let board: Cell[][] = [];
export let currentPlayer: Player = 1;
export let isAnimating = false;
export let isGameOver = false;
let isCurrentAppActive = false;

export function setGameOver(value: boolean): void {
  isGameOver = value;
}

const PLAYER_COLORS: Record<Player, [number, number, number]> = {
  1: [0, 127, 0],
  2: [127, 0, 0],
};

function padIdAt(row: number, col: number): number {
  return (row + 1) * 10 + (col + 1);
}

function cellAt(row: number, col: number): Cell | undefined {
  return board[row]?.[col];
}

export function resetGame(): void {
  clearGrid();
  board = Array(ROWS)
    .fill(0)
    .map(() => Array(COLS).fill(0));
  currentPlayer = 1;
  isAnimating = false;
  isGameOver = false;
  updateTopRow();
}

export function updateTopRow(): void {
  const color = PLAYER_COLORS[currentPlayer];
  for (let col = 0; col < COLS; col++) {
    setRGB(91 + col, color);
  }
}

function findLowestEmptyRow(col: number): number {
  for (let r = 0; r < ROWS; r++) {
    if (cellAt(r, col) === 0) return r;
  }
  return -1;
}

function placeDisc(row: number, col: number): void {
  const rowArr = board[row];
  if (rowArr) {
    rowArr[col] = currentPlayer;
  }
}

function resolveTurn(row: number, col: number): void {
  const winningLine = checkWin(row, col);
  if (winningLine) {
    handleWin(winningLine);
    return;
  }
  if (board.every((boardRow) => boardRow.every((cell) => cell !== 0))) {
    handleDraw();
    return;
  }
  currentPlayer = currentPlayer === 1 ? 2 : 1;
  updateTopRow();
  isAnimating = false;
}

export async function handleColumnSelect(col: number): Promise<void> {
  if (isAnimating || isGameOver) return;

  const targetRow = findLowestEmptyRow(col);
  if (targetRow === -1) return;

  isAnimating = true;
  await animateFall({ col, targetRow, player: currentPlayer });

  if (!isCurrentAppActive) {
    isAnimating = false;
    return;
  }

  placeDisc(targetRow, col);
  resolveTurn(targetRow, col);
}

export async function animateFall(fall: {
  col: number;
  targetRow: number;
  player: Player;
}): Promise<void> {
  const color = PLAYER_COLORS[fall.player];

  for (let r = 7; r >= fall.targetRow; r--) {
    if (!isCurrentAppActive) break;

    setRGB(padIdAt(r, fall.col), color);

    if (r < 7) {
      setRGB(padIdAt(r + 1, fall.col), [0, 0, 0]);
    }

    await new Promise((resolve) => setTimeout(resolve, FALL_SPEED_MS_PER_ROW));
  }
}

const WIN_DIRECTIONS: [number, number][] = [
  [0, 1],
  [1, 0],
  [1, 1],
  [1, -1],
];

function collectRun(
  origin: [number, number],
  direction: [number, number]
): [number, number][] {
  const [row, col] = origin;
  const [dr, dc] = direction;
  const player = cellAt(row, col);
  const run: [number, number][] = [];
  for (let i = 1; i < 4; i++) {
    const next: [number, number] = [row + dr * i, col + dc * i];
    if (cellAt(next[0], next[1]) !== player) break;
    run.push(next);
  }
  return run;
}

function lineThrough(
  origin: [number, number],
  direction: [number, number]
): [number, number][] {
  return [
    origin,
    ...collectRun(origin, direction),
    ...collectRun(origin, [-direction[0], -direction[1]]),
  ];
}

export function checkWin(row: number, col: number): [number, number][] | null {
  const player = cellAt(row, col);
  if (player === undefined || player === 0) return null;

  for (const direction of WIN_DIRECTIONS) {
    const winningCells = lineThrough([row, col], direction);
    if (winningCells.length >= 4) return winningCells;
  }
  return null;
}

function handleWin(winningLine: [number, number][]): void {
  const color = PLAYER_COLORS[currentPlayer];
  isGameOver = true;
  isAnimating = false;

  for (const [r, c] of winningLine) {
    setRGBFlashing(padIdAt(r, c), { rgb: color });
  }

  for (let col = 0; col < COLS; col++) {
    setRGBFlashing(91 + col, { rgb: color });
  }
}

function handleDraw(): void {
  isGameOver = true;
  isAnimating = false;
  for (let i = 11; i <= 88; i++) {
    setRGBFlashing(i, { rgb: [127, 0, 0] });
  }
  for (let i = 91; i <= 98; i++) {
    setRGBFlashing(i, { rgb: [127, 0, 0] });
  }
}

function handlePadPress(padId: number): void {
  if (isGameOver) {
    resetGame();
    return;
  }
  if (padId >= 91 && padId <= 98) {
    void handleColumnSelect(padId - 91);
  }
}

export const fourInARowApp: App = {
  name: "Four In A Row",

  init(): void {
    isCurrentAppActive = true;
    resetGame();
  },

  cleanup(): void {
    isCurrentAppActive = false;
  },

  onNoteOn(e: NoteMessageEvent): void {
    const velocity = e.note.rawAttack;
    if (velocity > 0 && isGameOver) {
      resetGame();
    }
  },

  onControlChange(e: ControlChangeMessageEvent): void {
    const velocity = e.message.data[2] ?? 0;
    if (velocity > 0) {
      handlePadPress(e.controller.number);
    }
  },
};

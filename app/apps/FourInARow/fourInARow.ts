import {
  clearGrid,
  setRGB,
  setRGBFlashing,
} from "../../grid";
import type { App } from "../../types";
import type { ControlChangeMessageEvent, NoteMessageEvent } from "webmidi";

export type Player = 1 | 2; // 1 = Green, 2 = Red
export type Cell = Player | 0;

const ROWS = 8;
const COLS = 8;
const FALL_SPEED = 100; // ms per row

export let board: Cell[][] = [];
export let currentPlayer: Player = 1;
export let isAnimating = false;
export let isGameOver = false;
let isCurrentAppActive = false;

export function setGameOver(value: boolean): void {
  isGameOver = value;
}

const PLAYER_COLORS: Record<Player, [number, number, number]> = {
  1: [0, 127, 0], // Green
  2: [127, 0, 0], // Red
};

export function resetGame(): void {
  console.log("[FourInARow] Resetting game...");
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
    setRGB(91 + col, ...color);
  }
}

export async function handleColumnSelect(col: number): Promise<void> {
  if (isAnimating || isGameOver) return;

  // Find the lowest empty row
  let targetRow = -1;
  for (let r = 0; r < ROWS; r++) {
    if (board[r]?.[col] === 0) {
      targetRow = r;
      break;
    }
  }

  if (targetRow === -1) return; // Column full

  isAnimating = true;
  await animateFall(col, targetRow, currentPlayer);

  // If the app was deactivated during the animation, abort setting board state
  if (!isCurrentAppActive) {
    isAnimating = false;
    return;
  }

  const rowArr = board[targetRow];
  if (rowArr) {
    rowArr[col] = currentPlayer;
  }

  const winningLine = checkWin(targetRow, col);
  if (winningLine) {
    handleWin(winningLine);
  } else if (board.every((row) => row.every((cell) => cell !== 0))) {
    handleDraw();
  } else {
    currentPlayer = currentPlayer === 1 ? 2 : 1;
    updateTopRow();
    isAnimating = false;
  }
}

export async function animateFall(
  col: number,
  targetRow: number,
  player: Player
): Promise<void> {
  const color = PLAYER_COLORS[player];
  const padOffset = (c: number, r: number) => (r + 1) * 10 + (c + 1);

  // Animate from row 7 (top) down to targetRow
  for (let r = 7; r >= targetRow; r--) {
    if (!isCurrentAppActive) break;

    const padId = padOffset(col, r);
    setRGB(padId, ...color);

    if (r < 7) {
      const prevPadId = padOffset(col, r + 1);
      setRGB(prevPadId, 0, 0, 0);
    }

    await new Promise((resolve) => setTimeout(resolve, FALL_SPEED));
  }
}

export function checkWin(row: number, col: number): [number, number][] | null {
  const player = board[row]?.[col];
  if (player === undefined || player === 0) return null;

  const directions: [number, number][] = [
    [0, 1], // Horizontal
    [1, 0], // Vertical
    [1, 1], // Diagonal \
    [1, -1], // Diagonal /
  ];

  for (const [dr, dc] of directions) {
    let winningCells: [number, number][] = [[row, col]];

    // Check one direction
    for (let i = 1; i < 4; i++) {
      const nr = row + dr * i;
      const nc = col + dc * i;
      if (
        nr >= 0 &&
        nr < ROWS &&
        nc >= 0 &&
        nc < COLS &&
        board[nr]?.[nc] === player
      ) {
        winningCells.push([nr, nc]);
      } else break;
    }

    // Check opposite direction
    for (let i = 1; i < 4; i++) {
      const nr = row - dr * i;
      const nc = col - dc * i;
      if (
        nr >= 0 &&
        nr < ROWS &&
        nc >= 0 &&
        nc < COLS &&
        board[nr]?.[nc] === player
      ) {
        winningCells.push([nr, nc]);
      } else break;
    }

    if (winningCells.length >= 4) return winningCells;
  }
  return null;
}

function handleWin(winningLine: [number, number][]): void {
  const color = PLAYER_COLORS[currentPlayer];
  isGameOver = true;
  isAnimating = false;

  // Flash only the winning tokens
  for (const [r, c] of winningLine) {
    const padId = (r + 1) * 10 + (c + 1);
    setRGBFlashing(padId, ...color);
  }

  // Flash top row in winning color
  for (let col = 0; col < COLS; col++) {
    setRGBFlashing(91 + col, ...color);
  }
}

function handleDraw(): void {
  isGameOver = true;
  isAnimating = false;
  // Flash everything red
  for (let i = 11; i <= 88; i++) {
    setRGBFlashing(i, 127, 0, 0);
  }
  for (let i = 91; i <= 98; i++) {
    setRGBFlashing(i, 127, 0, 0);
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
    const padId = e.controller.number;
    const velocity = e.message.data[2] || 0;

    if (velocity > 0) {
      if (isGameOver) {
        resetGame();
        return;
      }
      if (padId >= 91 && padId <= 98) {
        handleColumnSelect(padId - 91);
      }
    }
  }
};

import { clearGrid, setRGB, setRGBFlashing } from "../../grid";
import type { App } from "../../types";
import type { NoteMessageEvent, ControlChangeMessageEvent } from "webmidi";

export type BoardCell = {
  isMine: boolean;
  count: number;
  revealed: boolean;
  flagged: boolean;
};

type Coord = [number, number];

const ROWS = 8;
const COLS = 8;
const MINES_COUNT = 10;
const TOGGLE_BUTTON_PAD = 99;

export let board: BoardCell[][] = [];
export let isGenerated = false;
export let isGameOver = false;
export let isGameWon = false;
export let playMode: "reveal" | "flag" = "reveal";
let isCurrentAppActive = false;

const LONG_PRESS_MS = 400;
const pressTimers = new Map<number, any>();
const longPressedPads = new Set<number>();

export function resetGame(): void {
  console.log("[LogicMinesweeper] Resetting game...");
  isGenerated = false;
  isGameOver = false;
  isGameWon = false;
  playMode = "reveal";

  // Build empty board
  board = Array(ROWS)
    .fill(null)
    .map(() =>
      Array(COLS)
        .fill(null)
        .map(() => ({
          isMine: false,
          count: 0,
          revealed: false,
          flagged: false,
        }))
    );

  clearGrid();
  drawToggleModeButton();
  drawBoard();
}

function drawToggleModeButton(): void {
  if (playMode === "reveal") {
    setRGB(TOGGLE_BUTTON_PAD, 0, 80, 0); // Green for Reveal
  } else {
    setRGB(TOGGLE_BUTTON_PAD, 0, 0, 80); // Blue for Flag
  }
}

function drawBoard(): void {
  for (let r = 0; r < ROWS; r++) {
    const rowCells = board[r];
    if (!rowCells) continue;
    for (let c = 0; c < COLS; c++) {
      const cell = rowCells[c];
      if (!cell) continue;

      const padId = (r + 1) * 10 + (c + 1);

      if (cell.revealed) {
        if (cell.isMine) {
          // Triggered mine (angry red flash)
          setRGBFlashing(padId, 127, 0, 0, 300);
        } else if (cell.count === 0) {
          setRGB(padId, 0, 0, 0); // Off
        } else if (cell.count === 1) {
          setRGB(padId, 0, 60, 0); // Dim Green
        } else if (cell.count === 2) {
          setRGB(padId, 100, 100, 0); // Bright Yellow
        } else if (cell.count === 3) {
          setRGB(padId, 127, 40, 0); // Orange
        } else {
          setRGBFlashing(padId, 120, 0, 120, 1000); // Pulse Magenta
        }
      } else if (cell.flagged) {
        setRGB(padId, 0, 0, 127); // Flagged (solid Blue)
      } else {
        setRGB(padId, 15, 15, 15); // Unrevealed (dim White)
      }
    }
  }
}

function getNeighbors(r: number, c: number): Coord[] {
  const list: Coord[] = [];
  for (let dr = -1; dr <= 1; dr++) {
    for (let dc = -1; dc <= 1; dc++) {
      if (dr === 0 && dc === 0) continue;
      const nr = r + dr;
      const nc = c + dc;
      if (nr >= 0 && nr < ROWS && nc >= 0 && nc < COLS) {
        list.push([nr, nc]);
      }
    }
  }
  return list;
}

function generateNoGuessBoard(startR: number, startC: number): void {
  let attempts = 0;
  const maxAttempts = 1000;

  while (attempts < maxAttempts) {
    attempts++;
    // 1. Reset board
    for (let r = 0; r < ROWS; r++) {
      const row = board[r];
      if (row) {
        for (let c = 0; c < COLS; c++) {
          const cell = row[c];
          if (cell) {
            cell.isMine = false;
            cell.count = 0;
            cell.revealed = false;
            cell.flagged = false;
          }
        }
      }
    }

    // 2. Distribute mines (avoid startR, startC and neighbors)
    const forbidden: Coord[] = getNeighbors(startR, startC);
    forbidden.push([startR, startC]);

    const potentialSpots: Coord[] = [];
    for (let r = 0; r < ROWS; r++) {
      for (let c = 0; c < COLS; c++) {
        const isForbidden = forbidden.some(([fr, fc]) => fr === r && fc === c);
        if (!isForbidden) {
          potentialSpots.push([r, c]);
        }
      }
    }

    // Shuffle and pick 10
    for (let i = potentialSpots.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      const temp = potentialSpots[i];
      const nextTemp = potentialSpots[j];
      if (temp && nextTemp) {
        potentialSpots[i] = nextTemp;
        potentialSpots[j] = temp;
      }
    }

    const mineSpots = potentialSpots.slice(0, MINES_COUNT);
    for (const [mr, mc] of mineSpots) {
      const row = board[mr];
      if (row) {
        const cell = row[mc];
        if (cell) {
          cell.isMine = true;
        }
      }
    }

    // 3. Calculate adjacent counts
    for (let r = 0; r < ROWS; r++) {
      const row = board[r];
      if (row) {
        for (let c = 0; c < COLS; c++) {
          const cell = row[c];
          if (cell && !cell.isMine) {
            let count = 0;
            for (const [nr, nc] of getNeighbors(r, c)) {
              if (board[nr]?.[nc]?.isMine) count++;
            }
            cell.count = count;
          }
        }
      }
    }

    // 4. Test solvability
    if (isSolvable(startR, startC)) {
      console.log(`[LogicMinesweeper] Solvable board generated in ${attempts} attempt(s).`);
      isGenerated = true;
      return;
    }
  }

  // Fallback (should very rarely happen)
  console.warn("[LogicMinesweeper] Max generation attempts reached, using fallback.");
  isGenerated = true;
}

function isSolvable(startR: number, startC: number): boolean {
  const solved = board.map((row) =>
    row.map((cell) => ({
      isMine: cell.isMine,
      count: cell.count,
      revealed: false,
      flagged: false,
    }))
  );

  revealInSolver(solved, startR, startC);

  let progress = true;
  while (progress) {
    progress = false;

    for (let r = 0; r < ROWS; r++) {
      for (let c = 0; c < COLS; c++) {
        const cell = solved[r]?.[c];
        if (!cell || !cell.revealed || cell.count === 0) continue;

        const neighbors = getNeighbors(r, c);
        let flaggedCount = 0;
        let unrevealedCount = 0;
        const unrevealedList: Coord[] = [];

        for (const [nr, nc] of neighbors) {
          const nCell = solved[nr]?.[nc];
          if (nCell) {
            if (nCell.flagged) {
              flaggedCount++;
            } else if (!nCell.revealed) {
              unrevealedCount++;
              unrevealedList.push([nr, nc]);
            }
          }
        }

        // deduction 1: all remaining are safe
        if (flaggedCount === cell.count && unrevealedCount > 0) {
          for (const [ur, uc] of unrevealedList) {
            revealInSolver(solved, ur, uc);
          }
          progress = true;
        }

        // deduction 2: all remaining are mines
        if (flaggedCount + unrevealedCount === cell.count && unrevealedCount > 0) {
          for (const [ur, uc] of unrevealedList) {
            const urCell = solved[ur]?.[uc];
            if (urCell && !urCell.flagged) {
              urCell.flagged = true;
            }
          }
          progress = true;
        }
      }
    }
  }

  // Verify
  for (let r = 0; r < ROWS; r++) {
    for (let c = 0; c < COLS; c++) {
      const cell = solved[r]?.[c];
      if (cell && !cell.isMine && !cell.revealed) {
        return false;
      }
    }
  }
  return true;
}

function revealInSolver(solved: any[][], r: number, c: number): void {
  const cell = solved[r]?.[c];
  if (!cell || cell.revealed || cell.flagged) return;

  cell.revealed = true;
  if (cell.count === 0) {
    for (const [nr, nc] of getNeighbors(r, c)) {
      revealInSolver(solved, nr, nc);
    }
  }
}

function revealCell(r: number, c: number): void {
  const row = board[r];
  if (!row) return;
  const cell = row[c];
  if (!cell || cell.revealed || cell.flagged) return;

  cell.revealed = true;

  if (cell.isMine) {
    handleGameOver(r, c);
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
  let unrevealedSafeCells = 0;
  for (let r = 0; r < ROWS; r++) {
    for (let c = 0; c < COLS; c++) {
      const cell = board[r]?.[c];
      if (cell && !cell.isMine && !cell.revealed) {
        unrevealedSafeCells++;
      }
    }
  }

  if (unrevealedSafeCells === 0) {
    handleWin();
  }
}

function handleGameOver(triggeredR: number, triggeredC: number): void {
  console.log("[LogicMinesweeper] Boom! Game Over.");
  isGameOver = true;

  // Reveal all mines as red
  for (let r = 0; r < ROWS; r++) {
    for (let c = 0; c < COLS; c++) {
      const cell = board[r]?.[c];
      if (cell && cell.isMine) {
        cell.revealed = true;
      }
    }
  }

  // Redraw board (which draws triggered mine flashing, and others solid red)
  drawBoard();
}

function handleWin(): void {
  console.log("[LogicMinesweeper] Victory!");
  isGameWon = true;

  // Draw winning pattern (pulse green)
  for (let r = 0; r < ROWS; r++) {
    for (let c = 0; c < COLS; c++) {
      const padId = (r + 1) * 10 + (c + 1);
      setRGBFlashing(padId, 0, 127, 0, 1000);
    }
  }
}

export function handleGridPressStart(padId: number): void {
  if (isGameOver || isGameWon) {
    resetGame();
    return;
  }

  const r = Math.floor(padId / 10) - 1;
  const c = (padId % 10) - 1;
  if (r < 0 || r >= ROWS || c < 0 || c >= COLS) return;

  // Clear existing timer if any
  if (pressTimers.has(padId)) {
    clearTimeout(pressTimers.get(padId));
  }
  longPressedPads.delete(padId);

  const timer = setTimeout(() => {
    pressTimers.delete(padId);
    longPressedPads.add(padId);
    handleGridLongPress(padId);
  }, LONG_PRESS_MS);

  pressTimers.set(padId, timer);
}

export function handleGridPressEnd(padId: number): void {
  const timer = pressTimers.get(padId);
  if (timer) {
    clearTimeout(timer);
    pressTimers.delete(padId);
    handleGridShortPress(padId);
  } else if (longPressedPads.has(padId)) {
    longPressedPads.delete(padId);
  }
}

export function handleGridShortPress(padId: number): void {
  const r = Math.floor(padId / 10) - 1;
  const c = (padId % 10) - 1;
  if (r < 0 || r >= ROWS || c < 0 || c >= COLS) return;

  if (!isGenerated) {
    if (playMode === "flag") return; // cannot flag first click
    generateNoGuessBoard(r, c);
  }

  const row = board[r];
  if (!row) return;
  const cell = row[c];
  if (!cell) return;

  if (playMode === "reveal") {
    if (!cell.flagged) {
      revealCell(r, c);
      if (!isGameOver && !isGameWon) {
        drawBoard();
      }
    }
  } else {
    // Flag Mode
    if (!cell.revealed) {
      cell.flagged = !cell.flagged;
      drawBoard();
    }
  }
}

export function handleGridLongPress(padId: number): void {
  const r = Math.floor(padId / 10) - 1;
  const c = (padId % 10) - 1;
  if (r < 0 || r >= ROWS || c < 0 || c >= COLS) return;

  if (!isGenerated) {
    generateNoGuessBoard(r, c);
  }

  const row = board[r];
  if (!row) return;
  const cell = row[c];
  if (!cell) return;

  if (!cell.revealed) {
    cell.flagged = !cell.flagged;
    drawBoard();
  }
}

export function handleGridPress(padId: number): void {
  // Simulates a short press for compatibility and tests
  handleGridPressStart(padId);
  handleGridPressEnd(padId);
}


export function togglePlayMode(): void {
  playMode = playMode === "reveal" ? "flag" : "reveal";
  console.log(`[LogicMinesweeper] Mode toggled to: ${playMode.toUpperCase()}`);
  drawToggleModeButton();
}

export const logicMinesweeperApp: App = {
  name: "Logic Minesweeper",

  init(): void {
    isCurrentAppActive = true;
    resetGame();
  },

  cleanup(): void {
    isCurrentAppActive = false;
    for (const timer of pressTimers.values()) {
      clearTimeout(timer);
    }
    pressTimers.clear();
    longPressedPads.clear();
  },

  onNoteOn(e: NoteMessageEvent): void {
    const padId = e.note.number;
    const velocity = e.note.rawAttack;

    if (velocity > 0) {
      handleGridPressStart(padId);
    }
  },

  onNoteOff(e: NoteMessageEvent): void {
    const padId = e.note.number;
    handleGridPressEnd(padId);
  },

  onControlChange(e: ControlChangeMessageEvent): void {
    const padId = e.controller.number;
    const velocity = e.message.data[2] || 0;

    if (velocity > 0 && padId === TOGGLE_BUTTON_PAD) {
      togglePlayMode();
    }
  }
};

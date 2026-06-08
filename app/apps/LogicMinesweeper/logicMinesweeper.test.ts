import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import * as minesApp from "./logicMinesweeper";
import * as grid from "../../core/grid";

// Mock the grid module
vi.mock("../../core/grid", () => ({
  getColor: vi.fn(),
  setRGB: vi.fn(),
  setRGBFlashing: vi.fn(),
  enterProgrammerMode: vi.fn(),
  clearGrid: vi.fn(),
}));

// Mock the midi module
vi.mock("../../core/midi", () => ({
  lpInput: {
    removeListener: vi.fn(),
    addListener: vi.fn(),
  },
}));

describe("logicMinesweeper.ts", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    minesApp.logicMinesweeperApp.init();
  });

  afterEach(() => {
    minesApp.logicMinesweeperApp.cleanup?.();
  });

  it("should initialize empty board with 64 unrevealed dim white pads and toggle button", () => {
    expect(minesApp.isGenerated).toBe(false);
    expect(minesApp.isGameOver).toBe(false);
    expect(minesApp.isGameWon).toBe(false);
    expect(minesApp.playMode).toBe("reveal");

    expect(grid.clearGrid).toHaveBeenCalled();
    // Toggle button 99 set to green
    expect(grid.setRGB).toHaveBeenCalledWith(99, 0, 80, 0);
    // Grid cells lit up dim white
    expect(grid.setRGB).toHaveBeenCalledWith(11, 15, 15, 15);
  });

  it("should toggle play modes when togglePlayMode is called", () => {
    expect(minesApp.playMode).toBe("reveal");
    minesApp.togglePlayMode();
    expect(minesApp.playMode).toBe("flag");
    expect(grid.setRGB).toHaveBeenLastCalledWith(99, 0, 0, 80); // Blue for Flag

    minesApp.togglePlayMode();
    expect(minesApp.playMode).toBe("reveal");
    expect(grid.setRGB).toHaveBeenLastCalledWith(99, 0, 80, 0); // Green for Reveal
  });

  it("should generate solvable board on first click in reveal mode", () => {
    // Click at row 4 col 4 (pad 44, which is index r=3, c=3)
    minesApp.handleGridPress(44);

    expect(minesApp.isGenerated).toBe(true);
    // Clicked cell must be safe (isMine is false)
    expect(minesApp.board[3]![3]!.isMine).toBe(false);
    // First click must expand safe cells, so it should be revealed
    expect(minesApp.board[3]![3]!.revealed).toBe(true);
  });

  it("should allow flagging cells in flag mode", () => {
    // Generate board first
    minesApp.handleGridPress(44);

    // Switch to Flag Mode
    minesApp.togglePlayMode();

    // Find an unrevealed cell dynamically
    let unrevealedPadId = -1;
    for (let r = 0; r < 8; r++) {
      for (let c = 0; c < 8; c++) {
        if (!minesApp.board[r]![c]!.revealed) {
          unrevealedPadId = (r + 1) * 10 + (c + 1);
          break;
        }
      }
      if (unrevealedPadId !== -1) break;
    }
    expect(unrevealedPadId).not.toBe(-1);

    const targetR = Math.floor(unrevealedPadId / 10) - 1;
    const targetC = (unrevealedPadId % 10) - 1;

    // Flag the unrevealed cell
    minesApp.handleGridPress(unrevealedPadId);
    expect(minesApp.board[targetR]![targetC]!.flagged).toBe(true);
    expect(grid.setRGB).toHaveBeenCalledWith(unrevealedPadId, 0, 0, 127); // Blue for Flagged

    // Unflag
    minesApp.handleGridPress(unrevealedPadId);
    expect(minesApp.board[targetR]![targetC]!.flagged).toBe(false);
    expect(grid.setRGB).toHaveBeenCalledWith(unrevealedPadId, 15, 15, 15); // Reverts to dim white
  });

  it("should trigger game over when revealing a mine", () => {
    // Generate board
    minesApp.handleGridPress(44);

    // Find a mine on the generated board
    let mineR = -1;
    let mineC = -1;
    for (let r = 0; r < 8; r++) {
      for (let c = 0; c < 8; c++) {
        if (minesApp.board[r]![c]!.isMine) {
          mineR = r;
          mineC = c;
          break;
        }
      }
      if (mineR !== -1) break;
    }

    // Click on the mine
    const minePadId = (mineR + 1) * 10 + (mineC + 1);
    minesApp.handleGridPress(minePadId);

    expect(minesApp.isGameOver).toBe(true);
    expect(grid.setRGBFlashing).toHaveBeenCalledWith(minePadId, 127, 0, 0, 300); // Flashing red
  });

  it("should trigger win when all safe cells are revealed", () => {
    // Generate board
    minesApp.handleGridPress(44);

    // Find all safe cells
    const safeCells: { r: number; c: number }[] = [];
    for (let r = 0; r < 8; r++) {
      for (let c = 0; c < 8; c++) {
        if (!minesApp.board[r]![c]!.isMine) {
          safeCells.push({ r, c });
        }
      }
    }

    // Manually reveal all but the last safe cell
    for (let i = 0; i < safeCells.length - 1; i++) {
      const cell = safeCells[i]!;
      minesApp.board[cell.r]![cell.c]!.revealed = true;
    }

    // Click the last safe cell
    const lastSafe = safeCells[safeCells.length - 1]!;
    const lastPadId = (lastSafe.r + 1) * 10 + (lastSafe.c + 1);
    minesApp.handleGridPress(lastPadId);
    expect(minesApp.isGameWon).toBe(true);
  });

  it("should toggle flag status on long press", () => {
    // Generate board first
    minesApp.handleGridPress(44);

    // Find an unrevealed cell
    let unrevealedR = -1;
    let unrevealedC = -1;
    for (let r = 0; r < 8; r++) {
      for (let c = 0; c < 8; c++) {
        if (!minesApp.board[r]![c]!.revealed) {
          unrevealedR = r;
          unrevealedC = c;
          break;
        }
      }
      if (unrevealedR !== -1) break;
    }

    expect(unrevealedR).not.toBe(-1);
    const padId = (unrevealedR + 1) * 10 + (unrevealedC + 1);

    // Initial state: not flagged
    expect(minesApp.board[unrevealedR]![unrevealedC]!.flagged).toBe(false);

    // Trigger long press
    minesApp.handleGridLongPress(padId);
    expect(minesApp.board[unrevealedR]![unrevealedC]!.flagged).toBe(true);
    expect(grid.setRGB).toHaveBeenCalledWith(padId, 0, 0, 127);

    // Trigger long press again to unflag
    minesApp.handleGridLongPress(padId);
    expect(minesApp.board[unrevealedR]![unrevealedC]!.flagged).toBe(false);
    expect(grid.setRGB).toHaveBeenCalledWith(padId, 15, 15, 15);
  });
});

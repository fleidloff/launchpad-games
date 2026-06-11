import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import * as minesApp from "./logicMinesweeper";
import * as grid from "../../core/grid";

vi.mock("../../core/grid", () => ({
  getColor: vi.fn(),
  setRGB: vi.fn(),
  setRGBFlashing: vi.fn(),
  enterProgrammerMode: vi.fn(),
  clearGrid: vi.fn(),
}));

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
    expect(grid.setRGB).toHaveBeenCalledWith(99, [0, 80, 0]);
    expect(grid.setRGB).toHaveBeenCalledWith(11, [15, 15, 15]);
  });

  it("should toggle play modes when togglePlayMode is called", () => {
    expect(minesApp.playMode).toBe("reveal");
    minesApp.togglePlayMode();
    expect(minesApp.playMode).toBe("flag");
    expect(grid.setRGB).toHaveBeenLastCalledWith(99, [0, 0, 80]);

    minesApp.togglePlayMode();
    expect(minesApp.playMode).toBe("reveal");
    expect(grid.setRGB).toHaveBeenLastCalledWith(99, [0, 80, 0]);
  });

  it("should generate solvable board on first click in reveal mode", () => {
    minesApp.handleGridPress(44);

    expect(minesApp.isGenerated).toBe(true);
    expect(minesApp.board[3]![3]!.isMine).toBe(false);
    expect(minesApp.board[3]![3]!.revealed).toBe(true);
  });

  it("should allow flagging cells in flag mode", () => {
    minesApp.handleGridPress(44);

    minesApp.togglePlayMode();

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

    minesApp.handleGridPress(unrevealedPadId);
    expect(minesApp.board[targetR]![targetC]!.flagged).toBe(true);
    expect(grid.setRGB).toHaveBeenCalledWith(unrevealedPadId, [0, 0, 127]);

    minesApp.handleGridPress(unrevealedPadId);
    expect(minesApp.board[targetR]![targetC]!.flagged).toBe(false);
    expect(grid.setRGB).toHaveBeenCalledWith(unrevealedPadId, [15, 15, 15]);
  });

  it("should trigger game over when revealing a mine", () => {
    minesApp.handleGridPress(44);

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

    const minePadId = (mineR + 1) * 10 + (mineC + 1);
    minesApp.handleGridPress(minePadId);

    expect(minesApp.isGameOver).toBe(true);
    expect(grid.setRGBFlashing).toHaveBeenCalledWith(minePadId, {
      rgb: [127, 0, 0],
      duration: 300,
    });
  });

  it("should trigger win when all safe cells are revealed", () => {
    minesApp.handleGridPress(44);

    const safeCells: { r: number; c: number }[] = [];
    for (let r = 0; r < 8; r++) {
      for (let c = 0; c < 8; c++) {
        if (!minesApp.board[r]![c]!.isMine) {
          safeCells.push({ r, c });
        }
      }
    }

    for (const cell of safeCells) {
      minesApp.board[cell.r]![cell.c]!.revealed = true;
    }

    const lastSafe = safeCells[safeCells.length - 1]!;
    minesApp.board[lastSafe.r]![lastSafe.c]!.revealed = false;
    const lastPadId = (lastSafe.r + 1) * 10 + (lastSafe.c + 1);
    minesApp.handleGridPress(lastPadId);
    expect(minesApp.isGameWon).toBe(true);
  });

  it("should toggle flag status on long press", () => {
    minesApp.handleGridPress(44);

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

    expect(minesApp.board[unrevealedR]![unrevealedC]!.flagged).toBe(false);

    minesApp.handleGridLongPress(padId);
    expect(minesApp.board[unrevealedR]![unrevealedC]!.flagged).toBe(true);
    expect(grid.setRGB).toHaveBeenCalledWith(padId, [0, 0, 127]);

    minesApp.handleGridLongPress(padId);
    expect(minesApp.board[unrevealedR]![unrevealedC]!.flagged).toBe(false);
    expect(grid.setRGB).toHaveBeenCalledWith(padId, [15, 15, 15]);
  });
});

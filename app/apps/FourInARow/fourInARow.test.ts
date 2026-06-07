import { describe, it, expect, vi, beforeEach } from "vitest";
import * as fourInARow from "./fourInARow";
import * as grid from "../../grid";

// Mock the grid module
vi.mock("../../grid", () => ({
  getColor: vi.fn(),
  setRGB: vi.fn(),
  setRGBFlashing: vi.fn(),
  enterProgrammerMode: vi.fn(),
  clearGrid: vi.fn(),
}));

// Mock the midi module
vi.mock("../../midi", () => ({
  lpInput: {
    removeListener: vi.fn(),
    addListener: vi.fn(),
  },
  lpOutput: {},
}));

describe("fourInARow.ts", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    fourInARow.resetGame();
  });

  it("should initialize with an empty board and player 1", () => {
    expect(fourInARow.board.every(row => row.every(cell => cell === 0))).toBe(true);
    expect(fourInARow.currentPlayer).toBe(1);
    expect(grid.clearGrid).toHaveBeenCalled();
    expect(grid.setRGB).toHaveBeenCalledTimes(8); // Top row initialization
  });

  it("should detect a horizontal win", () => {
    // Manually set up a horizontal line for player 1
    fourInARow.board[0][0] = 1;
    fourInARow.board[0][1] = 1;
    fourInARow.board[0][2] = 1;
    fourInARow.board[0][3] = 1;

    const result = fourInARow.checkWin(0, 3);
    expect(result).not.toBeNull();
    expect(result?.length).toBe(4);
  });

  it("should detect a vertical win", () => {
    // Manually set up a vertical line for player 2
    fourInARow.board[0][5] = 2;
    fourInARow.board[1][5] = 2;
    fourInARow.board[2][5] = 2;
    fourInARow.board[3][5] = 2;

    const result = fourInARow.checkWin(3, 5);
    expect(result).not.toBeNull();
    expect(result?.length).toBe(4);
  });

  it("should detect a diagonal win (\\)", () => {
    fourInARow.board[0][0] = 1;
    fourInARow.board[1][1] = 1;
    fourInARow.board[2][2] = 1;
    fourInARow.board[3][3] = 1;

    const result = fourInARow.checkWin(3, 3);
    expect(result).not.toBeNull();
    expect(result?.length).toBe(4);
  });

  it("should detect a diagonal win (/)", () => {
    fourInARow.board[0][3] = 2;
    fourInARow.board[1][2] = 2;
    fourInARow.board[2][1] = 2;
    fourInARow.board[3][0] = 2;

    const result = fourInARow.checkWin(3, 0);
    expect(result).not.toBeNull();
    expect(result?.length).toBe(4);
  });

  it("should not detect a win with only 3 in a row", () => {
    fourInARow.board[0][0] = 1;
    fourInARow.board[0][1] = 1;
    fourInARow.board[0][2] = 1;

    expect(fourInARow.checkWin(0, 2)).toBeNull();
  });

  it("should reset the game when resetGame is called", () => {
    fourInARow.board[0][0] = 1;
    fourInARow.setGameOver(true);
    
    fourInARow.resetGame();
    
    expect(fourInARow.board[0][0]).toBe(0);
    expect(fourInARow.isGameOver).toBe(false);
    expect(fourInARow.currentPlayer).toBe(1);
  });
});

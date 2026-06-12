import { describe, it, expect, vi, beforeEach } from "vitest";
import * as meowdoku from "./meowdoku";
import * as grid from "../../core/grid";

vi.mock("../../core/grid", () => ({
  setRGB: vi.fn(),
  setRGBFlashing: vi.fn(),
  clearGrid: vi.fn(),
}));

vi.mock("../../core/midi", () => ({
  lpInput: {
    removeListener: vi.fn(),
    addListener: vi.fn(),
  },
  lpOutput: {},
}));

type Coord = [number, number];

const N = 8;

function regionAt(coord: Coord): number {
  return meowdoku.regions[coord[0]]?.[coord[1]] ?? -1;
}

function catAt(coord: Coord): boolean {
  return meowdoku.cats[coord[0]]?.[coord[1]] === true;
}

function distinctRegions(): Set<number> {
  const ids = new Set<number>();
  for (let r = 0; r < N; r++) {
    for (let c = 0; c < N; c++) {
      ids.add(regionAt([r, c]));
    }
  }
  return ids;
}

describe("meowdoku.ts", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
    meowdoku.newGame();
  });

  it("starts a fresh level with no cats, full hearts and a drawn board", () => {
    expect(meowdoku.catCount).toBe(0);
    expect(meowdoku.hearts).toBe(3);
    expect(meowdoku.solved).toBe(false);
    expect(meowdoku.failed).toBe(false);
    expect(grid.clearGrid).toHaveBeenCalled();
    expect(grid.setRGB).toHaveBeenCalled();
  });

  it("partitions the board into exactly N connected regions", () => {
    const ids = distinctRegions();
    expect(ids.size).toBe(N);
    expect([...ids].every((id) => id >= 0 && id < N)).toBe(true);
  });

  it("generates a puzzle that is always solvable", () => {
    expect(meowdoku.countSolutions(meowdoku.regions)).toBeGreaterThanOrEqual(1);
  });

  it("counts multiple solutions for an ambiguous region layout", () => {
    const rowsAsRegions = Array.from({ length: N }, (_unused, r) =>
      Array.from({ length: N }, () => r)
    );
    expect(meowdoku.countSolutions(rowsAsRegions)).toBeGreaterThan(1);
  });

  it("places a cat on an empty cell", () => {
    const cell = firstCellOfRegion(0);
    meowdoku.tapCell(cell);
    expect(catAt(cell)).toBe(true);
    expect(meowdoku.catCount).toBe(1);
  });

  it("removes a cat when its cell is tapped again", () => {
    const cell = firstCellOfRegion(0);
    meowdoku.tapCell(cell);
    meowdoku.tapCell(cell);
    expect(catAt(cell)).toBe(false);
    expect(meowdoku.catCount).toBe(0);
  });

  it("rejects a second cat in the same row and costs a heart", () => {
    meowdoku.tapCell([0, 0]);
    meowdoku.tapCell([0, 4]);
    expect(catAt([0, 4])).toBe(false);
    expect(meowdoku.catCount).toBe(1);
    expect(meowdoku.hearts).toBe(2);
  });

  it("rejects a cat that touches another cat diagonally", () => {
    meowdoku.tapCell([0, 0]);
    meowdoku.tapCell([1, 1]);
    expect(catAt([1, 1])).toBe(false);
    expect(meowdoku.hearts).toBe(2);
  });

  it("fails the level after three mistakes", () => {
    meowdoku.tapCell([0, 0]);
    meowdoku.tapCell([0, 2]);
    meowdoku.tapCell([0, 4]);
    meowdoku.tapCell([0, 6]);
    expect(meowdoku.hearts).toBe(0);
    expect(meowdoku.failed).toBe(true);
  });

  it("wins when the unique solution is placed, without losing hearts", () => {
    const solution = meowdoku.findSolution(meowdoku.regions);
    expect(solution).not.toBeNull();
    if (!solution) return;
    for (const cell of solution) {
      meowdoku.tapCell(cell);
    }
    expect(meowdoku.solved).toBe(true);
    expect(meowdoku.catCount).toBe(N);
    expect(meowdoku.hearts).toBe(3);
  });

  function firstCellOfRegion(target: number): Coord {
    for (let r = 0; r < N; r++) {
      for (let c = 0; c < N; c++) {
        if (regionAt([r, c]) === target) return [r, c];
      }
    }
    return [0, 0];
  }
});

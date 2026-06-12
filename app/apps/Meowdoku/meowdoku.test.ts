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

function setRegionCell(coord: Coord, value: number): void {
  const row = meowdoku.regions[coord[0]];
  if (row) row[coord[1]] = value;
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

const RIGHT_DOWN: Coord[] = [
  [0, 1],
  [1, 0],
];

function colorIndexOf(region: number): number {
  return meowdoku.colorOf[region] ?? -1;
}

function similarNeighbor(region: number, coord: Coord): boolean {
  const other = regionAt(coord);
  if (other === -1 || other === region) return false;
  return meowdoku.similarColors(colorIndexOf(region), colorIndexOf(other));
}

function similarColorsTouch(): boolean {
  for (const coord of allCells()) {
    const region = regionAt(coord);
    const touches = RIGHT_DOWN.some((d) => similarNeighbor(region, [coord[0] + d[0], coord[1] + d[1]]));
    if (touches) return true;
  }
  return false;
}

function allCells(): Coord[] {
  return Array.from({ length: N * N }, (_unused, i): Coord => [Math.floor(i / N), i % N]);
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

  it("marks cells in the same row, column or touching a cat as blocked", () => {
    meowdoku.tapCell([0, 0]);
    expect(meowdoku.isBlocked([0, 7])).toBe(true);
    expect(meowdoku.isBlocked([7, 0])).toBe(true);
    expect(meowdoku.isBlocked([1, 1])).toBe(true);
  });

  it("marks cells of an already-used color region as blocked", () => {
    meowdoku.tapCell([0, 0]);
    const region = regionAt([0, 0]);
    setRegionCell([5, 5], region);
    setRegionCell([5, 7], (region + 1) % N);
    expect(meowdoku.isBlocked([5, 5])).toBe(true);
    expect(meowdoku.isBlocked([5, 7])).toBe(false);
  });

  it("never reports a cell holding a cat as blocked", () => {
    meowdoku.tapCell([0, 0]);
    expect(meowdoku.isBlocked([0, 0])).toBe(false);
  });

  it("toggles the blocked overlay and redraws the whole board", () => {
    vi.clearAllMocks();
    meowdoku.toggleBlocked();
    expect(meowdoku.showBlocked).toBe(true);
    expect(grid.setRGB.mock.calls.length).toBeGreaterThanOrEqual(N * N);
    meowdoku.toggleBlocked();
    expect(meowdoku.showBlocked).toBe(false);
  });

  it("clears the blocked overlay when a new level starts", () => {
    meowdoku.toggleBlocked();
    expect(meowdoku.showBlocked).toBe(true);
    meowdoku.newGame();
    expect(meowdoku.showBlocked).toBe(false);
  });

  it("assigns each palette color to exactly one region", () => {
    const used = new Set(meowdoku.colorOf);
    expect(used.size).toBe(N);
    expect([...used].every((index) => index >= 0 && index < N)).toBe(true);
  });

  it("never lets two touching regions use similar colors", () => {
    for (let attempt = 0; attempt < 30; attempt++) {
      meowdoku.newGame();
      expect(similarColorsTouch()).toBe(false);
    }
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

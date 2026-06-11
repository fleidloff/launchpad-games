import { describe, it, expect, vi, beforeEach } from "vitest";
import { handlePadPress } from "./basicButtons";
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

describe("basicButtons.ts", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should turn pad green if it is currently off", () => {
    vi.mocked(grid.getColor).mockReturnValue(null);

    handlePadPress(11, 127);

    expect(grid.setRGB).toHaveBeenCalledWith(11, [0, 127, 0]);
  });

  it("should turn pad off if it is currently on", () => {
    vi.mocked(grid.getColor).mockReturnValue([0, 127, 0]);

    handlePadPress(11, 127);

    expect(grid.setRGB).toHaveBeenCalledWith(11, [0, 0, 0]);
  });
});

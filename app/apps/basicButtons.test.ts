import { describe, it, expect, vi, beforeEach } from "vitest";
import { handlePadPress } from "./basicButtons";
import * as grid from "../grid";

// Mock the grid module
vi.mock("../grid", () => ({
  getColor: vi.fn(),
  setRGB: vi.fn(),
  setRGBFlashing: vi.fn(),
  enterProgrammerMode: vi.fn(),
  clearGrid: vi.fn(),
}));

// Mock the midi module
vi.mock("../midi", () => ({
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
    // Setup: Pad 11 is off
    (grid.getColor as any).mockReturnValue(null);
    
    handlePadPress(11, 127);
    
    // The current logic in basicButtons uses setRGB for new green pads
    expect(grid.setRGB).toHaveBeenCalledWith(11, 0, 127, 0);
  });

  it("should turn pad off if it is currently on", () => {
    // Setup: Pad 11 is on (some color)
    (grid.getColor as any).mockReturnValue([0, 127, 0]);
    
    handlePadPress(11, 127);
    
    expect(grid.setRGB).toHaveBeenCalledWith(11, 0, 0, 0);
  });
});

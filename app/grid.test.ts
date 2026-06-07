import { describe, it, expect, vi, beforeEach } from "vitest";
import { setRGB, getColor, clearGrid, enterProgrammerMode } from "./grid";
import * as midi from "./midi";

// Mock the midi module
vi.mock("./midi", () => ({
  lpOutput: {
    sendSysex: vi.fn(),
    send: vi.fn(),
  },
}));

describe("grid.ts", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should initialize all pads to off", () => {
    // Check a random pad (e.g., 11)
    expect(getColor(11)).toBeNull();
  });

  it("should update state and send MIDI on setRGB", () => {
    setRGB(11, 10, 20, 30);
    
    // Check state
    expect(getColor(11)).toEqual([10, 20, 30]);
    
    // Check MIDI call
    expect(midi.lpOutput?.send).toHaveBeenCalled();
    const sentMessage = (midi.lpOutput?.send as any).mock.calls[0][0];
    expect(sentMessage).toContain(10); // red
    expect(sentMessage).toContain(20); // green
    expect(sentMessage).toContain(30); // blue
  });

  it("should return null for getColor if RGB is all zeros", () => {
    setRGB(15, 0, 0, 0);
    expect(getColor(15)).toBeNull();
  });

  it("should clear the grid", () => {
    setRGB(11, 255, 255, 255);
    expect(getColor(11)).not.toBeNull();
    
    clearGrid();
    expect(getColor(11)).toBeNull();
  });

  it("should send the correct SysEx for Programmer Mode", () => {
    enterProgrammerMode();
    expect(midi.lpOutput?.sendSysex).toHaveBeenCalledWith(
      [0x00, 0x20, 0x29],
      [0x02, 0x0c, 0x0e, 0x03]
    );
  });
});

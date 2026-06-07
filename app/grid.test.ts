import { describe, it, expect, vi, beforeEach } from "vitest";
import { setRGB, setRGBFlashing, setMenuRGB, setMenuRGBFlashing, getColor, clearGrid, enterProgrammerMode } from "./grid";
import * as midi from "./midi";

// Mock the midi module
vi.mock("./midi", () => ({
  lpOutput: {
    sendSysex: vi.fn(),
    send: vi.fn(),
  },
}));

// Mock performance and requestAnimationFrame for testing
const mockPerformanceNow = vi.fn(() => 0);
global.performance.now = mockPerformanceNow;

const mockRequestAnimationFrame = vi.fn();
const mockCancelAnimationFrame = vi.fn();
global.requestAnimationFrame = mockRequestAnimationFrame;
global.cancelAnimationFrame = mockCancelAnimationFrame;

describe("grid.ts", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Reset grid state between tests by clearing it
    clearGrid();
    vi.clearAllMocks(); // Clear mocks again after clearGrid calls sendRGB
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

  it("should set flashing state and return target color for getColor", () => {
    setRGBFlashing(21, 255, 0, 0);
    
    // getColor should return the target color even if flashing
    expect(getColor(21)).toEqual([255, 0, 0]);
    
    // Should have triggered animation loop
    expect(mockRequestAnimationFrame).toHaveBeenCalled();
  });

  it("should stop animation when no more pads are flashing", () => {
    setRGBFlashing(21, 255, 0, 0);
    expect(mockRequestAnimationFrame).toHaveBeenCalled();
    
    // Turning it off (solid 0,0,0) should stop animation
    setRGB(21, 0, 0, 0);
    expect(mockCancelAnimationFrame).toHaveBeenCalled();
  });

  it("should clear the grid and stop animation", () => {
    setRGBFlashing(11, 255, 255, 255);
    expect(getColor(11)).not.toBeNull();
    
    clearGrid();
    expect(getColor(11)).toBeNull();
    expect(mockCancelAnimationFrame).toHaveBeenCalled();
  });

  it("should send the correct SysEx for Programmer Mode", () => {
    enterProgrammerMode();
    expect(midi.lpOutput?.sendSysex).toHaveBeenCalledWith(
      [0x00, 0x20, 0x29],
      [0x02, 0x0c, 0x0e, 0x03]
    );
  });

  it("should ignore standard setRGB and setRGBFlashing calls on protected menu column pads", () => {
    setRGB(79, 127, 127, 127);
    expect(getColor(79)).toBeNull(); // remains off

    setRGBFlashing(79, 127, 127, 127);
    expect(getColor(79)).toBeNull(); // remains off
  });

  it("should allow setMenuRGB and setMenuRGBFlashing on protected menu column pads", () => {
    setMenuRGB(79, 127, 127, 127);
    expect(getColor(79)).toEqual([127, 127, 127]);

    setMenuRGBFlashing(79, 100, 100, 100);
    expect(getColor(79)).toEqual([100, 100, 100]);
  });

  it("should not affect protected pads when clearGrid is called", () => {
    setMenuRGB(79, 127, 127, 127);
    expect(getColor(79)).toEqual([127, 127, 127]);

    clearGrid();
    // 79 should still be set since it is protected from clearGrid
    expect(getColor(79)).toEqual([127, 127, 127]);
  });
});

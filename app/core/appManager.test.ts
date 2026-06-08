import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { AppManager } from "./appManager";
import * as grid from "./grid";
import * as midi from "./midi";
import type { App } from "../types";

vi.mock("./grid", () => ({
  enterProgrammerMode: vi.fn(),
  clearGrid: vi.fn(),
  setRGB: vi.fn(),
  setRGBFlashing: vi.fn(),
  setMenuRGB: vi.fn(),
  setMenuRGBFlashing: vi.fn(),
}));

vi.mock("./midi", () => {
  const mockInput = {
    removeListener: vi.fn(),
    addListener: vi.fn(),
  };
  return {
    lpInput: mockInput,
  };
});

describe("AppManager", () => {
  let manager: AppManager;
  let mockApp1: App;
  let mockApp2: App;
  let listeners: Record<string, Function>;

  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();

    listeners = {};
    (midi.lpInput!.addListener as any).mockImplementation((event: string, callback: Function) => {
      listeners[event] = callback;
    });

    mockApp1 = {
      name: "Mock App 1",
      init: vi.fn(),
      cleanup: vi.fn(),
      onNoteOn: vi.fn(),
      onNoteOff: vi.fn(),
      onControlChange: vi.fn(),
    };

    mockApp2 = {
      name: "Mock App 2",
      init: vi.fn(),
      cleanup: vi.fn(),
      onNoteOn: vi.fn(),
      onNoteOff: vi.fn(),
      onControlChange: vi.fn(),
    };

    manager = new AppManager();
    manager.registerApp(89, mockApp1);
    manager.registerApp(79, mockApp2);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("should initialize and launch the default registered app", () => {
    manager.init();

    expect(midi.lpInput!.removeListener).toHaveBeenCalled();
    expect(midi.lpInput!.addListener).toHaveBeenCalledTimes(3); // noteon, noteoff, controlchange
    expect(grid.enterProgrammerMode).toHaveBeenCalled();
    expect(grid.clearGrid).toHaveBeenCalled();
    expect(mockApp1.init).toHaveBeenCalled();
    expect(manager.getActiveApp()).toBe(mockApp1);
  });

  it("should forward noteon and noteoff events to the active app", () => {
    manager.init();

    const noteonCallback = listeners["noteon"];
    const noteoffCallback = listeners["noteoff"];

    expect(noteonCallback).toBeDefined();
    expect(noteoffCallback).toBeDefined();

    const mockEvent = { note: { number: 11, rawAttack: 127 } } as any;
    noteonCallback!(mockEvent);
    expect(mockApp1.onNoteOn).toHaveBeenCalledWith(mockEvent);

    noteoffCallback!(mockEvent);
    expect(mockApp1.onNoteOff).toHaveBeenCalledWith(mockEvent);
  });

  it("should forward non-switching control change events to the active app", () => {
    manager.init();

    const ccCallback = listeners["controlchange"];
    expect(ccCallback).toBeDefined();

    const mockEvent = { controller: { number: 91 }, message: { data: [0xb0, 91, 127] } } as any;
    ccCallback!(mockEvent);
    expect(mockApp1.onControlChange).toHaveBeenCalledWith(mockEvent);
  });

  it("should not switch apps immediately on menu button press, but flash and start a hold timer", () => {
    manager.init();

    const ccCallback = listeners["controlchange"];
    const pressEvent = { controller: { number: 79 }, message: { data: [0xb0, 79, 127] } } as any;

    ccCallback!(pressEvent);

    // App should not have switched yet
    expect(manager.getActiveApp()).toBe(mockApp1);
    expect(grid.setMenuRGBFlashing).toHaveBeenCalledWith(79, 127, 0, 0, 300);
    expect(mockApp2.init).not.toHaveBeenCalled();
  });

  it("should switch apps if menu button is held for 2 seconds", () => {
    manager.init();

    const ccCallback = listeners["controlchange"];
    const pressEvent = { controller: { number: 79 }, message: { data: [0xb0, 79, 127] } } as any;

    ccCallback!(pressEvent);

    // Advance time by 2 seconds
    vi.advanceTimersByTime(2000);

    expect(mockApp1.cleanup).toHaveBeenCalled();
    expect(grid.clearGrid).toHaveBeenCalledTimes(2); // Initial boot + switchApp clear
    expect(mockApp2.init).toHaveBeenCalled();
    expect(manager.getActiveApp()).toBe(mockApp2);
  });

  it("should cancel app switch if menu button is released before 2 seconds", () => {
    manager.init();

    const ccCallback = listeners["controlchange"];
    const pressEvent = { controller: { number: 79 }, message: { data: [0xb0, 79, 127] } } as any;
    const releaseEvent = { controller: { number: 79 }, message: { data: [0xb0, 79, 0] } } as any;

    // Press down
    ccCallback!(pressEvent);

    // Advance 1 second
    vi.advanceTimersByTime(1000);

    // Release early
    ccCallback!(releaseEvent);

    // Advance another 1.5 seconds (total 2.5 seconds from press)
    vi.advanceTimersByTime(1500);

    // App should not have switched
    expect(manager.getActiveApp()).toBe(mockApp1);
    expect(mockApp2.init).not.toHaveBeenCalled();
    expect(grid.setMenuRGB).toHaveBeenCalledWith(79, 20, 20, 20); // Restored inactive color
  });

  it("should trigger onNoteOnLongPress and onControlChangeLongPress if buttons are held", () => {
    // Let's define long press handlers on a mock app
    const longPressApp: App = {
      name: "Long Press App",
      init: vi.fn(),
      cleanup: vi.fn(),
      onNoteOn: vi.fn(),
      onNoteOff: vi.fn(),
      onControlChange: vi.fn(),
      onNoteOnLongPress: vi.fn(),
      onControlChangeLongPress: vi.fn(),
    };

    const lpManager = new AppManager();
    lpManager.registerApp(89, longPressApp);
    lpManager.init();

    const noteonCallback = listeners["noteon"];
    const noteoffCallback = listeners["noteoff"];
    const ccCallback = listeners["controlchange"];

    expect(noteonCallback).toBeDefined();
    expect(noteoffCallback).toBeDefined();
    expect(ccCallback).toBeDefined();

    // 1. Test Note Long Press
    const mockNoteEvent = { note: { number: 12, rawAttack: 127 } } as any;
    noteonCallback!(mockNoteEvent);

    // Fast-forward 200ms: should not trigger long press yet
    vi.advanceTimersByTime(200);
    expect(longPressApp.onNoteOnLongPress).not.toHaveBeenCalled();
    expect(longPressApp.onNoteOn).not.toHaveBeenCalled();

    // Fast-forward another 200ms (total 400ms): should trigger long press
    vi.advanceTimersByTime(200);
    expect(longPressApp.onNoteOnLongPress).toHaveBeenCalledWith(mockNoteEvent);
    expect(longPressApp.onNoteOn).not.toHaveBeenCalled();

    // Release (NoteOff): should not trigger short press (onNoteOn)
    const mockNoteOffEvent = { note: { number: 12, rawAttack: 0 } } as any;
    noteoffCallback!(mockNoteOffEvent);
    expect(longPressApp.onNoteOn).not.toHaveBeenCalled();
    expect(longPressApp.onNoteOff).toHaveBeenCalledWith(mockNoteOffEvent);

    // 2. Test Note Short Press
    vi.clearAllMocks();
    noteonCallback!(mockNoteEvent);
    vi.advanceTimersByTime(200);
    noteoffCallback!(mockNoteOffEvent);

    // Should trigger short press (onNoteOn) on release
    expect(longPressApp.onNoteOn).toHaveBeenCalledWith(mockNoteEvent);
    expect(longPressApp.onNoteOnLongPress).not.toHaveBeenCalled();
    expect(longPressApp.onNoteOff).toHaveBeenCalledWith(mockNoteOffEvent);

    // 3. Test CC Long Press
    const mockCCPressEvent = { controller: { number: 92 }, message: { data: [0xb0, 92, 127] } } as any;
    ccCallback!(mockCCPressEvent);

    vi.advanceTimersByTime(200);
    expect(longPressApp.onControlChangeLongPress).not.toHaveBeenCalled();

    vi.advanceTimersByTime(200);
    expect(longPressApp.onControlChangeLongPress).toHaveBeenCalledWith(mockCCPressEvent);
    expect(longPressApp.onControlChange).not.toHaveBeenCalled();

    // CC release
    const mockCCReleaseEvent = { controller: { number: 92 }, message: { data: [0xb0, 92, 0] } } as any;
    ccCallback!(mockCCReleaseEvent);
    expect(longPressApp.onControlChange).not.toHaveBeenCalled();

    // 4. Test CC Short Press
    vi.clearAllMocks();
    ccCallback!(mockCCPressEvent);
    vi.advanceTimersByTime(200);
    ccCallback!(mockCCReleaseEvent);

    expect(longPressApp.onControlChange).toHaveBeenCalledWith(mockCCPressEvent);
    expect(longPressApp.onControlChangeLongPress).not.toHaveBeenCalled();
  });
});

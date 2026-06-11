import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import type { Mock } from "vitest";
import { AppManager } from "./appManager";
import * as grid from "./grid";
import * as midi from "./midi";
import type { App } from "../types";
import type { NoteMessageEvent, ControlChangeMessageEvent } from "webmidi";

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

type ListenerCallback = (e: unknown) => void;

function makeNoteEvent(number: number, rawAttack: number): NoteMessageEvent {
  return { note: { number, rawAttack } } as unknown as NoteMessageEvent;
}

function makeCcEvent(number: number, velocity: number): ControlChangeMessageEvent {
  return {
    controller: { number },
    message: { data: [0xb0, number, velocity] },
  } as unknown as ControlChangeMessageEvent;
}

describe("AppManager", () => {
  let manager: AppManager;
  let mockApp1: App;
  let mockApp2: App;
  let listeners: Record<string, ListenerCallback>;

  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();

    listeners = {};
    (midi.lpInput!.addListener as unknown as Mock).mockImplementation(
      (event: string, callback: ListenerCallback) => {
        listeners[event] = callback;
      }
    );

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
    expect(midi.lpInput!.addListener).toHaveBeenCalledTimes(3);
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

    const mockEvent = makeNoteEvent(11, 127);
    noteonCallback!(mockEvent);
    expect(mockApp1.onNoteOn).toHaveBeenCalledWith(mockEvent);

    noteoffCallback!(mockEvent);
    expect(mockApp1.onNoteOff).toHaveBeenCalledWith(mockEvent);
  });

  it("should forward non-switching control change events to the active app", () => {
    manager.init();

    const ccCallback = listeners["controlchange"];
    expect(ccCallback).toBeDefined();

    const mockEvent = makeCcEvent(91, 127);
    ccCallback!(mockEvent);
    expect(mockApp1.onControlChange).toHaveBeenCalledWith(mockEvent);
  });

  it("should not switch apps immediately on menu button press, but flash and start a hold timer", () => {
    manager.init();

    const ccCallback = listeners["controlchange"];
    const pressEvent = makeCcEvent(79, 127);

    ccCallback!(pressEvent);

    expect(manager.getActiveApp()).toBe(mockApp1);
    expect(grid.setMenuRGBFlashing).toHaveBeenCalledWith(79, {
      rgb: [127, 0, 0],
      duration: 300,
    });
    expect(mockApp2.init).not.toHaveBeenCalled();
  });

  it("should switch apps if menu button is held for 2 seconds", () => {
    manager.init();

    const ccCallback = listeners["controlchange"];
    const pressEvent = makeCcEvent(79, 127);

    ccCallback!(pressEvent);

    vi.advanceTimersByTime(2000);

    expect(mockApp1.cleanup).toHaveBeenCalled();
    expect(grid.clearGrid).toHaveBeenCalledTimes(2);
    expect(mockApp2.init).toHaveBeenCalled();
    expect(manager.getActiveApp()).toBe(mockApp2);
  });

  it("should cancel app switch if menu button is released before 2 seconds", () => {
    manager.init();

    const ccCallback = listeners["controlchange"];
    const pressEvent = makeCcEvent(79, 127);
    const releaseEvent = makeCcEvent(79, 0);

    ccCallback!(pressEvent);

    vi.advanceTimersByTime(1000);

    ccCallback!(releaseEvent);

    vi.advanceTimersByTime(1500);

    expect(manager.getActiveApp()).toBe(mockApp1);
    expect(mockApp2.init).not.toHaveBeenCalled();
    expect(grid.setMenuRGB).toHaveBeenCalledWith(79, [20, 20, 20]);
  });

  it("should trigger onNoteOnLongPress and onControlChangeLongPress if buttons are held", () => {
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

    const mockNoteEvent = makeNoteEvent(12, 127);
    noteonCallback!(mockNoteEvent);

    vi.advanceTimersByTime(200);
    expect(longPressApp.onNoteOnLongPress).not.toHaveBeenCalled();
    expect(longPressApp.onNoteOn).not.toHaveBeenCalled();

    vi.advanceTimersByTime(200);
    expect(longPressApp.onNoteOnLongPress).toHaveBeenCalledWith(mockNoteEvent);
    expect(longPressApp.onNoteOn).not.toHaveBeenCalled();

    const mockNoteOffEvent = makeNoteEvent(12, 0);
    noteoffCallback!(mockNoteOffEvent);
    expect(longPressApp.onNoteOn).not.toHaveBeenCalled();
    expect(longPressApp.onNoteOff).toHaveBeenCalledWith(mockNoteOffEvent);

    vi.clearAllMocks();
    noteonCallback!(mockNoteEvent);
    vi.advanceTimersByTime(200);
    noteoffCallback!(mockNoteOffEvent);

    expect(longPressApp.onNoteOn).toHaveBeenCalledWith(mockNoteEvent);
    expect(longPressApp.onNoteOnLongPress).not.toHaveBeenCalled();
    expect(longPressApp.onNoteOff).toHaveBeenCalledWith(mockNoteOffEvent);

    const mockCCPressEvent = makeCcEvent(92, 127);
    ccCallback!(mockCCPressEvent);

    vi.advanceTimersByTime(200);
    expect(longPressApp.onControlChangeLongPress).not.toHaveBeenCalled();

    vi.advanceTimersByTime(200);
    expect(longPressApp.onControlChangeLongPress).toHaveBeenCalledWith(mockCCPressEvent);
    expect(longPressApp.onControlChange).not.toHaveBeenCalled();

    const mockCCReleaseEvent = makeCcEvent(92, 0);
    ccCallback!(mockCCReleaseEvent);
    expect(longPressApp.onControlChange).not.toHaveBeenCalled();

    vi.clearAllMocks();
    ccCallback!(mockCCPressEvent);
    vi.advanceTimersByTime(200);
    ccCallback!(mockCCReleaseEvent);

    expect(longPressApp.onControlChange).toHaveBeenCalledWith(mockCCPressEvent);
    expect(longPressApp.onControlChangeLongPress).not.toHaveBeenCalled();
  });
});

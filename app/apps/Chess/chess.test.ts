import { describe, it, expect, vi, beforeEach } from "vitest";
import type { NoteMessageEvent, ControlChangeMessageEvent } from "webmidi";
import {
  chess,
  squareToPad,
  padToSquare,
  isLightSquare,
  findAttackers,
  findKingSquare,
  getPhase,
  getHumanSide,
  getShowMoves,
} from "./chess";

vi.mock("../../core/grid", () => ({
  setRGB: vi.fn(),
  setRGBFlashing: vi.fn(),
}));

vi.mock("../../core/midi", () => ({
  lpInput: { removeListener: vi.fn(), addListener: vi.fn() },
  lpOutput: {},
}));

function noteEvent(pad: number): NoteMessageEvent {
  return { note: { number: pad, rawAttack: 127 } } as unknown as NoteMessageEvent;
}

function ccEvent(controller: number): ControlChangeMessageEvent {
  return {
    controller: { number: controller },
    message: { data: [0, 0, 127] },
  } as unknown as ControlChangeMessageEvent;
}

function press(square: string): void {
  chess.onNoteOn?.(noteEvent(squareToPad(square)));
}

function control(controller: number): void {
  chess.onControlChange?.(ccEvent(controller));
}

function longPress(controller: number): void {
  chess.onControlChangeLongPress?.(ccEvent(controller));
}

describe("chess square mapping", () => {
  it("maps squares to pads matching the launchpad layout", () => {
    expect(squareToPad("A1")).toBe(11);
    expect(squareToPad("H8")).toBe(88);
    expect(squareToPad("E2")).toBe(25);
  });

  it("round-trips pad to square", () => {
    expect(padToSquare(11)).toBe("A1");
    expect(padToSquare(88)).toBe("H8");
    expect(padToSquare(25)).toBe("E2");
  });

  it("lights the board in a checkerboard pattern", () => {
    expect(isLightSquare(11)).toBe(false);
    expect(isLightSquare(18)).toBe(true);
    expect(isLightSquare(88)).toBe(false);
  });
});

describe("chess check detection", () => {
  it("finds a rook giving check along a file", () => {
    const pieces = { E1: "K", E8: "r", A1: "R" } as const;
    const kingSquare = findKingSquare(pieces, "white");
    expect(kingSquare).toBe("E1");
    const attackers = findAttackers({ pieces, kingSquare: "E1", byColor: "black" });
    expect(attackers).toEqual(["E8"]);
  });

  it("ignores attackers blocked by another piece", () => {
    const pieces = { E1: "K", E4: "P", E8: "r" } as const;
    const attackers = findAttackers({ pieces, kingSquare: "E1", byColor: "black" });
    expect(attackers).toEqual([]);
  });

  it("detects a knight check", () => {
    const pieces = { E1: "K", F3: "n" } as const;
    const attackers = findAttackers({ pieces, kingSquare: "E1", byColor: "black" });
    expect(attackers).toEqual(["F3"]);
  });
});

describe("chess game flow", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    chess.init();
  });

  it("starts in setup awaiting a side pick", () => {
    expect(getPhase()).toBe("setup");
  });

  it("picks white when a white token is pressed and lets white move", () => {
    press("E2");
    expect(getHumanSide()).toBe("white");
    expect(getPhase()).toBe("humanFrom");
  });

  it("picks black when a black token is pressed and AI moves first", () => {
    press("E7");
    expect(getHumanSide()).toBe("black");
    expect(getPhase()).toBe("aiFrom");
  });

  it("selects a piece then completes a legal human move", () => {
    press("E2");
    press("E2");
    expect(getPhase()).toBe("humanTo");
    press("E4");
    expect(getPhase()).toBe("aiFrom");
  });

  it("releases the selection when the same field is pressed, allowing a new token", () => {
    press("E2");
    press("E2");
    expect(getPhase()).toBe("humanTo");
    press("E2");
    expect(getPhase()).toBe("humanFrom");
    press("D2");
    press("D4");
    expect(getPhase()).toBe("aiFrom");
  });

  it("reselects directly when a different own token is pressed", () => {
    press("E2");
    press("E2");
    press("D2");
    expect(getPhase()).toBe("humanTo");
    press("D4");
    expect(getPhase()).toBe("aiFrom");
  });

  it("toggles showing possible moves with button 97", () => {
    expect(getShowMoves()).toBe(true);
    control(97);
    expect(getShowMoves()).toBe(false);
    control(97);
    expect(getShowMoves()).toBe(true);
  });

  it("sets difficulty during setup via buttons 91-95", () => {
    control(94);
    press("E7");
    expect(getHumanSide()).toBe("black");
  });

  it("long pressing 98 starts a new game from setup", () => {
    press("E2");
    expect(getPhase()).toBe("humanFrom");
    longPress(98);
    expect(getPhase()).toBe("setup");
  });
});

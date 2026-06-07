import type { App } from "../../types";
import type { NoteMessageEvent, ControlChangeMessageEvent } from "webmidi";
import { setRGB, setRGBFlashing, clearGrid } from "../../grid";

// Colors (Restricted to 0-127 for Launchpad X)
const COLOR_P1 = { r: 0, g: 0, b: 127 }; // Solid Blue
const COLOR_P2 = { r: 127, g: 127, b: 0 }; // Solid Yellow
const COLOR_FAIL_RING = { r: 127, g: 0, b: 0 }; // Flashing Red for error ring

interface GameState {
  p1Targets: number[]; // Active pad IDs P1 must hold
  p2Targets: number[]; // Active pad IDs P2 must hold
  p1Held: Set<number>; // Track currently pressed pads by P1
  p2Held: Set<number>; // Track currently pressed pads by P2
  isGameOver: boolean;
  allFingersCleared: boolean; // Flag ensuring players lifted everything after loss
}

const state: GameState = {
  p1Targets: [],
  p2Targets: [],
  p1Held: new Set(),
  p2Held: new Set(),
  isGameOver: false,
  allFingersCleared: false,
};

function getRandomPad(
  minRow: number,
  maxRow: number,
  existingTargets: number[]
): number {
  let padId = 0;
  let attempts = 0;

  while (attempts < 100) {
    const row = Math.floor(Math.random() * (maxRow - minRow + 1)) + minRow;
    const col = Math.floor(Math.random() * 8) + 1;
    padId = row * 10 + col;

    if (
      !existingTargets.includes(padId) &&
      !state.p1Targets.includes(padId) &&
      !state.p2Targets.includes(padId)
    ) {
      break;
    }
    attempts++;
  }
  return padId;
}

function render(): void {
  if (state.isGameOver) return;

  clearGrid();

  for (let i = 11; i < 19; i++) {
    setRGB(i, COLOR_P1.r / 10, COLOR_P1.g / 10, COLOR_P1.b / 10);
    setRGB(i + 70, COLOR_P2.r / 10, COLOR_P2.g / 10, COLOR_P2.b / 10);
  }

  // Render Player 1 targets (Blue)
  state.p1Targets.forEach((padId) => {
    setRGB(padId, COLOR_P1.r, COLOR_P1.g, COLOR_P1.b);
  });

  // Render Player 2 targets (Yellow)
  state.p2Targets.forEach((padId) => {
    setRGB(padId, COLOR_P2.r, COLOR_P2.g, COLOR_P2.b);
  });
}

function spawnNextRound(): void {
  const p1Next = getRandomPad(1, 5, state.p1Targets);
  const p2Next = getRandomPad(4, 8, state.p2Targets);

  state.p1Targets.push(p1Next);
  state.p2Targets.push(p2Next);

  render();
}

/**
 * Calculates surrounding valid pad IDs forming a ring/circle around the target pad.
 */
function getSurroundingRing(centerPadId: number): number[] {
  const row = Math.floor(centerPadId / 10);
  const col = centerPadId % 10;
  const ring: number[] = [];

  for (let r = row - 1; r <= row + 1; r++) {
    for (let c = col - 1; c <= col + 1; c++) {
      // Skip the center pad itself
      if (r === row && c === col) continue;

      // Ensure target coordinates exist on the physical 8x8 play grid
      if (r >= 1 && r <= 8 && c >= 1 && c <= 8) {
        ring.push(r * 10 + c);
      }
    }
  }
  return ring;
}

function triggerGameOver(errorPadId: number): void {
  state.isGameOver = true;
  state.allFingersCleared = false; // Must be verified by release events

  // Keep the current state visible on grid but switch the guilty pad's ring to flashing red
  const ringPads = getSurroundingRing(errorPadId);
  ringPads.forEach((padId) => {
    // 300ms flash duration sequence
    setRGBFlashing(
      padId,
      COLOR_FAIL_RING.r,
      COLOR_FAIL_RING.g,
      COLOR_FAIL_RING.b,
      300
    );
  });
}

function checkRoundCompletion(): void {
  const p1Satisfied = state.p1Targets.every((padId) => state.p1Held.has(padId));
  const p2Satisfied = state.p2Targets.every((padId) => state.p2Held.has(padId));

  if (p1Satisfied && p2Satisfied) {
    spawnNextRound();
  }
}

function checkGlobalRelease(): void {
  // Check if both physical sets tracking pad interactions are totally vacant
  if (state.p1Held.size === 0 && state.p2Held.size === 0) {
    state.allFingersCleared = true;
  }
}

export const fingerTwister: App = {
  name: "Finger Twister",

  init(): void {
    state.isGameOver = false;
    state.allFingersCleared = false;
    state.p1Targets = [];
    state.p2Targets = [];
    state.p1Held.clear();
    state.p2Held.clear();

    spawnNextRound();
  },

  cleanup(): void {
    state.p1Held.clear();
    state.p2Held.clear();
  },

  onNoteOn(e: NoteMessageEvent): void {
    const padId = e.note.number;

    // 1. Post-Game Loop Interaction Check
    if (state.isGameOver) {
      if (state.allFingersCleared) {
        // Safe restart triggered by tapping any button after complete liftoff
        this.init();
      }
      return;
    }

    // 2. Active Game Loop Management
    if (state.p1Targets.includes(padId)) {
      state.p1Held.add(padId);
    } else if (state.p2Targets.includes(padId)) {
      state.p2Held.add(padId);
    } else {
      // General track for any random button press on grid so they can't sneakily rest palms
      state.p1Held.add(padId);
    }

    checkRoundCompletion();
  },

  onNoteOff(e: NoteMessageEvent): void {
    const padId = e.note.number;

    // Always remove from tracked held maps regardless of game state
    state.p1Held.delete(padId);
    state.p2Held.delete(padId);

    if (state.isGameOver) {
      checkGlobalRelease();
      return;
    }

    // Check if the lifted pad was an essential required target anchor
    if (state.p1Targets.includes(padId) || state.p2Targets.includes(padId)) {
      triggerGameOver(padId);
    }
  },

  onControlChange(e: ControlChangeMessageEvent): void {
    // Intercept control changes (Top menu buttons) to act as restart vectors too
    if (state.isGameOver && state.allFingersCleared && e.value > 0) {
      this.init();
    }
  },
};

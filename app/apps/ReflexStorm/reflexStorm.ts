import type { App } from "../../types";
import type { NoteMessageEvent, ControlChangeMessageEvent } from "webmidi";
import { setRGB, setRGBFlashing, clearGrid } from "../../grid";

// Colors (Restricted to 0-127 for Launchpad X)
const COLOR_TARGET = { r: 0, g: 127, b: 64 }; // Teal/Cyan Target
const COLOR_FAIL_RING = { r: 127, g: 0, b: 0 }; // Flashing Red ring on loss
const COLOR_BACKGROUND = { r: 5, g: 5, b: 5 }; // Ultra-dim white background for orientation

interface GameState {
  score: number;
  currentPads: number[]; // Array of Pad IDs making up the current active target
  hasHitCurrentTarget: boolean;
  isGameOver: boolean;
  allFingersCleared: boolean;

  // Game Loop Timers
  spawnTimer: NodeJS.Timeout | null;
  lifespanTimer: NodeJS.Timeout | null;

  // Dynamic Difficulty Parameters
  currentLifespanMs: number; // How long the target stays lit
  currentIntervalMs: number; // Delay before the next target spawns
}

const state: GameState = {
  score: 0,
  currentPads: [],
  hasHitCurrentTarget: false,
  isGameOver: false,
  allFingersCleared: true,
  spawnTimer: null,
  lifespanTimer: null,
  currentLifespanMs: 1500, // Start casual
  currentIntervalMs: 800,
};

function renderBackground(): void {
  // Give a faint ambient glow so the player can see the grid boundaries in the dark
  for (let r = 1; r <= 8; r++) {
    for (let c = 1; c <= 8; c++) {
      setRGB(
        r * 10 + c,
        COLOR_BACKGROUND.r,
        COLOR_BACKGROUND.g,
        COLOR_BACKGROUND.b
      );
    }
  }
}

function generateTargetCluster(score: number): number[] {
  const pads: number[] = [];

  // Phase 1 (Score 0-9): Large 2x2 blocks of 4 pads
  // Phase 2 (Score 10+): Precise single pads
  if (score < 100) {
    // Pick a random anchor row/col from 1-7 so the 2x2 block fits safely inside 1-8
    const baseRow = Math.floor(Math.random() * 7) + 1;
    const baseCol = Math.floor(Math.random() * 7) + 1;

    pads.push(baseRow * 10 + baseCol);
    pads.push(baseRow * 10 + (baseCol + 1));
    pads.push((baseRow + 1) * 10 + baseCol);
    pads.push((baseRow + 1) * 10 + (baseCol + 1));
  } else {
    const row = Math.floor(Math.random() * 8) + 1;
    const col = Math.floor(Math.random() * 8) + 1;
    pads.push(row * 10 + col);
  }

  return pads;
}

function triggerGameOver(failedPadId: number): void {
  state.isGameOver = true;
  state.allFingersCleared = false;

  if (state.spawnTimer) clearTimeout(state.spawnTimer);
  if (state.lifespanTimer) clearTimeout(state.lifespanTimer);

  // Leave everything dim, but turn the failed target ring flashing red
  const row = Math.floor(failedPadId / 10);
  const col = failedPadId % 10;

  for (let r = row - 1; r <= row + 1; r++) {
    for (let c = col - 1; c <= col + 1; c++) {
      if (r === row && c === col) continue;
      if (r >= 1 && r <= 8 && c >= 1 && c <= 8) {
        setRGBFlashing(
          r * 10 + c,
          COLOR_FAIL_RING.r,
          COLOR_FAIL_RING.g,
          COLOR_FAIL_RING.b,
          250
        );
      }
    }
  }
}

function spawnTarget(): void {
  if (state.isGameOver) return;

  renderBackground();

  state.currentPads = generateTargetCluster(state.score);
  state.hasHitCurrentTarget = false;

  // Light up the target cluster
  state.currentPads.forEach((padId) => {
    setRGB(padId, COLOR_TARGET.r, COLOR_TARGET.g, COLOR_TARGET.b);
  });

  // Start the ticking lifespan window for this target
  state.lifespanTimer = setTimeout(() => {
    if (!state.hasHitCurrentTarget) {
      // Player was too slow! Punish them using the first pad of the cluster as the epicenter
      triggerGameOver(state.currentPads[0]);
    } else {
      // Clean up target visually, then prepare the next cycle
      renderBackground();

      // Step up difficulty curve exponentially over time
      state.currentLifespanMs = Math.max(300, state.currentLifespanMs - 45);
      state.currentIntervalMs = Math.max(150, state.currentIntervalMs - 30);

      state.spawnTimer = setTimeout(spawnTarget, state.currentIntervalMs);
    }
  }, state.currentLifespanMs);
}

export const reflexStorm: App = {
  name: "Reflex Storm",

  init(): void {
    state.score = 0;
    state.isGameOver = false;
    state.allFingersCleared = true;
    state.currentPads = [];
    state.hasHitCurrentTarget = false;
    state.currentLifespanMs = 1500;
    state.currentIntervalMs = 800;

    spawnTarget();
  },

  cleanup(): void {
    if (state.spawnTimer) clearTimeout(state.spawnTimer);
    if (state.lifespanTimer) clearTimeout(state.lifespanTimer);
  },

  onNoteOn(e: NoteMessageEvent): void {
    const padId = e.note.number;

    if (state.isGameOver) {
      if (state.allFingersCleared) {
        this.init();
      }
      return;
    }

    // Set tracker flags upon active game input
    state.allFingersCleared = false;

    // Check if user hit any valid coordinate component of our active target
    if (state.currentPads.includes(padId) && !state.hasHitCurrentTarget) {
      state.hasHitCurrentTarget = true;
      state.score++;

      // Flash target instantly to give satisfying optical hit acknowledgment
      state.currentPads.forEach((p) => setRGB(p, 0, 127, 0));
    } else if (!state.currentPads.includes(padId)) {
      // Misclicking an empty pad is an immediate reflex disqualification!
      triggerGameOver(padId);
    }
  },

  onNoteOff(): void {
    // Since we don't have global state loops polling physical hardware note state indexes,
    // we assume safe clearance happens when players completely back off.
    // For single-player reflex scenarios, WebMIDI note-off signals no hands are touching.
    state.allFingersCleared = true;
  },

  onControlChange(e: ControlChangeMessageEvent): void {
    if (state.isGameOver && state.allFingersCleared && e.value > 0) {
      this.init();
    }
  },
};

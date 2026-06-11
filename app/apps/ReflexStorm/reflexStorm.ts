import type { App } from "../../types";
import type { RGB } from "../../types";
import type { NoteMessageEvent, ControlChangeMessageEvent } from "webmidi";
import { setRGB, setRGBFlashing } from "../../core/grid";

const TARGET_COLOR: RGB = [0, 127, 64];
const FAIL_RING_COLOR: RGB = [127, 0, 0];
const BACKGROUND_COLOR: RGB = [5, 5, 5];
const HIT_FLASH_COLOR: RGB = [0, 127, 0];
const FAIL_RING_FLASH_DURATION_MS = 250;
const INITIAL_LIFESPAN_MS = 1500;
const INITIAL_INTERVAL_MS = 800;
const MIN_LIFESPAN_MS = 300;
const LIFESPAN_STEP_MS = 45;
const MIN_INTERVAL_MS = 150;
const INTERVAL_STEP_MS = 30;
const SINGLE_PAD_PHASE_SCORE = 100;

interface GameState {
  score: number;
  currentPads: number[];
  hasHitCurrentTarget: boolean;
  isGameOver: boolean;
  allFingersCleared: boolean;
  hasStarted: boolean;
  spawnTimer: NodeJS.Timeout | null;
  lifespanTimer: NodeJS.Timeout | null;
  currentLifespanMs: number;
  currentIntervalMs: number;
}

interface RingBounds {
  minRow: number;
  maxRow: number;
  minCol: number;
  maxCol: number;
}

interface Cell {
  row: number;
  col: number;
}

const state: GameState = {
  score: 0,
  currentPads: [],
  hasHitCurrentTarget: false,
  isGameOver: false,
  allFingersCleared: true,
  hasStarted: false,
  spawnTimer: null,
  lifespanTimer: null,
  currentLifespanMs: INITIAL_LIFESPAN_MS,
  currentIntervalMs: INITIAL_INTERVAL_MS,
};

function renderBackground(): void {
  for (let row = 1; row <= 8; row++) {
    for (let col = 1; col <= 8; col++) {
      setRGB(row * 10 + col, BACKGROUND_COLOR);
    }
  }
}

function generateTargetCluster(score: number): number[] {
  if (score < SINGLE_PAD_PHASE_SCORE) {
    const baseRow = Math.floor(Math.random() * 7) + 1;
    const baseCol = Math.floor(Math.random() * 7) + 1;
    return [
      baseRow * 10 + baseCol,
      baseRow * 10 + (baseCol + 1),
      (baseRow + 1) * 10 + baseCol,
      (baseRow + 1) * 10 + (baseCol + 1),
    ];
  }

  const row = Math.floor(Math.random() * 8) + 1;
  const col = Math.floor(Math.random() * 8) + 1;
  return [row * 10 + col];
}

function lightTargetPads(): void {
  state.currentPads.forEach((padId) => {
    setRGB(padId, TARGET_COLOR);
  });
}

function clearGameTimers(): void {
  if (state.spawnTimer) clearTimeout(state.spawnTimer);
  if (state.lifespanTimer) clearTimeout(state.lifespanTimer);
}

function computeRingBounds(pads: number[]): RingBounds {
  const rows = pads.map((padId) => Math.floor(padId / 10));
  const cols = pads.map((padId) => padId % 10);
  return {
    minRow: Math.min(...rows),
    maxRow: Math.max(...rows),
    minCol: Math.min(...cols),
    maxCol: Math.max(...cols),
  };
}

function isInsideBounds(cell: Cell, bounds: RingBounds): boolean {
  const rowInside = cell.row >= bounds.minRow && cell.row <= bounds.maxRow;
  const colInside = cell.col >= bounds.minCol && cell.col <= bounds.maxCol;
  return rowInside && colInside;
}

function isOnGrid(cell: Cell): boolean {
  const rowOnGrid = cell.row >= 1 && cell.row <= 8;
  const colOnGrid = cell.col >= 1 && cell.col <= 8;
  return rowOnGrid && colOnGrid;
}

function flashRingCell(cell: Cell, bounds: RingBounds): void {
  if (isInsideBounds(cell, bounds)) return;
  if (!isOnGrid(cell)) return;
  setRGBFlashing(cell.row * 10 + cell.col, {
    rgb: FAIL_RING_COLOR,
    duration: FAIL_RING_FLASH_DURATION_MS,
  });
}

function drawFailRing(bounds: RingBounds): void {
  for (let row = bounds.minRow - 1; row <= bounds.maxRow + 1; row++) {
    for (let col = bounds.minCol - 1; col <= bounds.maxCol + 1; col++) {
      flashRingCell({ row, col }, bounds);
    }
  }
}

function triggerGameOver(failedPadId: number): void {
  state.isGameOver = true;
  state.allFingersCleared = false;
  clearGameTimers();

  const padsToRing =
    state.currentPads.length > 0 ? state.currentPads : [failedPadId];
  drawFailRing(computeRingBounds(padsToRing));
}

function handleLifespanExpired(): void {
  if (!state.hasHitCurrentTarget) {
    triggerGameOver(state.currentPads[0] ?? 0);
    return;
  }

  renderBackground();
  state.currentLifespanMs = Math.max(
    MIN_LIFESPAN_MS,
    state.currentLifespanMs - LIFESPAN_STEP_MS
  );
  state.currentIntervalMs = Math.max(
    MIN_INTERVAL_MS,
    state.currentIntervalMs - INTERVAL_STEP_MS
  );
  state.spawnTimer = setTimeout(spawnTarget, state.currentIntervalMs);
}

function spawnTarget(): void {
  if (state.isGameOver) return;

  renderBackground();

  state.currentPads = generateTargetCluster(state.score);
  state.hasHitCurrentTarget = false;
  lightTargetPads();

  state.lifespanTimer = setTimeout(handleLifespanExpired, state.currentLifespanMs);
}

function registerHit(): void {
  state.hasHitCurrentTarget = true;
  state.score++;
  state.currentPads.forEach((padId) => {
    setRGB(padId, HIT_FLASH_COLOR);
  });
}

function handleFirstPress(padId: number): void {
  if (state.currentPads.includes(padId)) {
    state.hasStarted = true;
    registerHit();
    state.spawnTimer = setTimeout(spawnTarget, state.currentIntervalMs);
    return;
  }
  triggerGameOver(padId);
}

function handleRunningPress(padId: number): void {
  if (!state.currentPads.includes(padId)) {
    triggerGameOver(padId);
    return;
  }
  if (!state.hasHitCurrentTarget) {
    registerHit();
  }
}

function resolveVelocity(e: ControlChangeMessageEvent): number {
  if (e.value === undefined) {
    return e.message.data[2] || 0;
  }
  return Number(e.value);
}

export const reflexStorm: App = {
  name: "Reflex Storm",

  init(): void {
    state.score = 0;
    state.isGameOver = false;
    state.allFingersCleared = true;
    state.hasStarted = false;
    state.hasHitCurrentTarget = false;
    state.currentLifespanMs = INITIAL_LIFESPAN_MS;
    state.currentIntervalMs = INITIAL_INTERVAL_MS;

    renderBackground();

    state.currentPads = generateTargetCluster(0);
    lightTargetPads();
  },

  cleanup(): void {
    clearGameTimers();
  },

  onNoteOn(e: NoteMessageEvent): void {
    const padId = e.note.number;

    if (state.isGameOver) {
      if (state.allFingersCleared) {
        this.init();
      }
      return;
    }

    state.allFingersCleared = false;

    if (!state.hasStarted) {
      handleFirstPress(padId);
      return;
    }

    handleRunningPress(padId);
  },

  onNoteOff(): void {
    state.allFingersCleared = true;
  },

  onControlChange(e: ControlChangeMessageEvent): void {
    if (state.isGameOver && state.allFingersCleared && resolveVelocity(e) > 0) {
      this.init();
    }
  },
};

import type { App } from "../../types";
import type { NoteMessageEvent, ControlChangeMessageEvent } from "webmidi";
import { setRGB, setRGBFlashing, clearGrid } from "../../core/grid";

const COLOR_P1 = { r: 0, g: 0, b: 127 };
const COLOR_P2 = { r: 127, g: 127, b: 0 };
const COLOR_FAIL_RING = { r: 127, g: 0, b: 0 };

interface GameState {
  p1Targets: number[];
  p2Targets: number[];
  p1Held: Set<number>;
  p2Held: Set<number>;
  isGameOver: boolean;
  allFingersCleared: boolean;
}

const state: GameState = {
  p1Targets: [],
  p2Targets: [],
  p1Held: new Set(),
  p2Held: new Set(),
  isGameOver: false,
  allFingersCleared: false,
};

interface RandomPadOptions {
  minRow: number;
  maxRow: number;
  existingTargets: number[];
}

function isPadFree(padId: number, existingTargets: number[]): boolean {
  return (
    !existingTargets.includes(padId) &&
    !state.p1Targets.includes(padId) &&
    !state.p2Targets.includes(padId)
  );
}

function getRandomPad(options: RandomPadOptions): number {
  const { minRow, maxRow, existingTargets } = options;
  let padId = 0;
  let attempts = 0;

  while (attempts < 100) {
    const row = Math.floor(Math.random() * (maxRow - minRow + 1)) + minRow;
    const col = Math.floor(Math.random() * 8) + 1;
    padId = row * 10 + col;

    if (isPadFree(padId, existingTargets)) {
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
    setRGB(i, [COLOR_P1.r / 10, COLOR_P1.g / 10, COLOR_P1.b / 10]);
    setRGB(i + 70, [COLOR_P2.r / 10, COLOR_P2.g / 10, COLOR_P2.b / 10]);
  }

  state.p1Targets.forEach((padId) => {
    setRGB(padId, [COLOR_P1.r, COLOR_P1.g, COLOR_P1.b]);
  });

  state.p2Targets.forEach((padId) => {
    setRGB(padId, [COLOR_P2.r, COLOR_P2.g, COLOR_P2.b]);
  });
}

function spawnNextRound(): void {
  const p1Next = getRandomPad({
    minRow: 1,
    maxRow: 5,
    existingTargets: state.p1Targets,
  });
  const p2Next = getRandomPad({
    minRow: 4,
    maxRow: 8,
    existingTargets: state.p2Targets,
  });

  state.p1Targets.push(p1Next);
  state.p2Targets.push(p2Next);

  render();
}

const RING_OFFSETS: [number, number][] = [
  [-1, -1],
  [-1, 0],
  [-1, 1],
  [0, -1],
  [0, 1],
  [1, -1],
  [1, 0],
  [1, 1],
];

function isOnPlayGrid(coord: { row: number; col: number }): boolean {
  return coord.row >= 1 && coord.row <= 8 && coord.col >= 1 && coord.col <= 8;
}

function getSurroundingRing(centerPadId: number): number[] {
  const row = Math.floor(centerPadId / 10);
  const col = centerPadId % 10;

  return RING_OFFSETS.map(([rowOffset, colOffset]) => ({
    row: row + rowOffset,
    col: col + colOffset,
  }))
    .filter(isOnPlayGrid)
    .map((coord) => coord.row * 10 + coord.col);
}

function triggerGameOver(errorPadId: number): void {
  state.isGameOver = true;
  state.allFingersCleared = false;

  const ringPads = getSurroundingRing(errorPadId);
  ringPads.forEach((padId) => {
    setRGBFlashing(padId, {
      rgb: [COLOR_FAIL_RING.r, COLOR_FAIL_RING.g, COLOR_FAIL_RING.b],
      duration: 300,
    });
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

    if (state.isGameOver) {
      if (state.allFingersCleared) {
        this.init();
      }
      return;
    }

    if (state.p1Targets.includes(padId)) {
      state.p1Held.add(padId);
    } else if (state.p2Targets.includes(padId)) {
      state.p2Held.add(padId);
    } else {
      state.p1Held.add(padId);
    }

    checkRoundCompletion();
  },

  onNoteOff(e: NoteMessageEvent): void {
    const padId = e.note.number;

    state.p1Held.delete(padId);
    state.p2Held.delete(padId);

    if (state.isGameOver) {
      checkGlobalRelease();
      return;
    }

    if (state.p1Targets.includes(padId) || state.p2Targets.includes(padId)) {
      triggerGameOver(padId);
    }
  },

  onControlChange(e: ControlChangeMessageEvent): void {
    if (state.isGameOver && state.allFingersCleared && e.value > 0) {
      this.init();
    }
  },
};

import type { App, RGB } from "../../types";
import type { NoteMessageEvent } from "webmidi";
import { setRGB, clearGrid } from "../../core/grid";

const TICK_INTERVAL_MS = 140;
const COLUMN_COUNT = 8;
const FUEL_BED_OFFSETS = [3, 1.8, 0.6, 0.1] as const;
const FUEL_BED_SPREADS = [1.5, 1, 0.8, 0.3] as const;
const CORE_COOLING_RATE = 0.45;
const FLANK_COOLING_RATE = 0.75;
const STOKE_BURST_INTENSITY = 4.8;
const STOKE_DECAY_PER_TICK = 0.2;
const STOKED_LOG_THRESHOLD = 1.2;

interface FireplaceState {
  heatGrid: number[][];
  simInterval: ReturnType<typeof setInterval> | null;
  stokeIntensity: number;
}

function createHeatGrid(): number[][] {
  return Array.from({ length: 9 }, () => Array.from({ length: 8 }, () => 0));
}

const state: FireplaceState = {
  heatGrid: createHeatGrid(),
  simInterval: null,
  stokeIntensity: 0,
};

function getPixelArtColor(heat: number): RGB {
  if (heat > 4.2) return [127, 127, 110];
  if (heat > 2.8) return [127, 115, 0];
  if (heat > 1.5) return [127, 40, 0];
  if (heat > 0.5) return [75, 5, 0];
  return [0, 0, 0];
}

function heatAt(col: number, row: number): number {
  return state.heatGrid[col]?.[row] ?? 0;
}

function baseHeatForColumn(col: number): number {
  const distanceFromCenter = Math.min(Math.abs(col - 4), Math.abs(col - 5));
  const offset = FUEL_BED_OFFSETS[distanceFromCenter] ?? 0;
  const spread = FUEL_BED_SPREADS[distanceFromCenter] ?? 0;
  return offset + Math.random() * spread;
}

function refreshFuelBed(): void {
  const stokeBoost = Math.max(0, state.stokeIntensity);
  for (let col = 1; col <= COLUMN_COUNT; col++) {
    const column = state.heatGrid[col];
    if (column) {
      column[0] = baseHeatForColumn(col) + stokeBoost;
    }
  }
}

function driftedSourceColumn(col: number): number {
  const randomFactor = Math.random();
  if (randomFactor < 0.25) return col - 1;
  if (randomFactor > 0.75) return col + 1;
  return col;
}

function sourceHeatFor(col: number, row: number): number {
  const sourceCol = driftedSourceColumn(col);
  const isInsideGrid = sourceCol >= 1 && sourceCol <= COLUMN_COUNT;
  return isInsideGrid ? heatAt(sourceCol, row - 1) : heatAt(col, row - 1);
}

function coolingRateForColumn(col: number): number {
  const isFlank = col <= 2 || col >= 7;
  return isFlank ? FLANK_COOLING_RATE : CORE_COOLING_RATE;
}

function propagateHeatUpward(): void {
  for (let row = 7; row >= 1; row--) {
    for (let col = 1; col <= COLUMN_COUNT; col++) {
      const column = state.heatGrid[col];
      if (column) {
        column[row] = Math.max(
          0,
          sourceHeatFor(col, row) - coolingRateForColumn(col),
        );
      }
    }
  }
}

function restingLogColor(col: number): RGB {
  if (col === 1 || col === 8) return [15, 6, 2];
  if (col === 2 || col === 7) return [35, 10, 2];
  const corePulse = 55 + Math.floor(Math.sin(Date.now() / 150 + col) * 15);
  return [corePulse, 12, 0];
}

function renderLogs(): void {
  const isStoked = state.stokeIntensity > STOKED_LOG_THRESHOLD;
  for (let col = 1; col <= COLUMN_COUNT; col++) {
    setRGB(10 + col, isStoked ? [127, 127, 80] : restingLogColor(col));
  }
}

function renderFlamePad(col: number, row: number): void {
  const color = getPixelArtColor(heatAt(col, row));
  const padId = (row + 1) * 10 + col;
  if (padId > 18) {
    setRGB(padId, color);
  }
}

function renderFlames(): void {
  for (let row = 1; row <= 7; row++) {
    for (let col = 1; col <= COLUMN_COUNT; col++) {
      renderFlamePad(col, row);
    }
  }
}

function updateSimulation(): void {
  if (state.stokeIntensity > 0) {
    state.stokeIntensity -= STOKE_DECAY_PER_TICK;
  }

  refreshFuelBed();
  propagateHeatUpward();

  clearGrid();
  renderLogs();
  renderFlames();
}

export const fireplace: App = {
  name: "Tamagotchi Fireplace",

  init(): void {
    state.stokeIntensity = 0;
    state.heatGrid = createHeatGrid();
    state.simInterval = setInterval(updateSimulation, TICK_INTERVAL_MS);
  },

  cleanup(): void {
    if (state.simInterval) {
      clearInterval(state.simInterval);
      state.simInterval = null;
    }
  },

  onNoteOn(e: NoteMessageEvent): void {
    const padId = e.note.number;
    const row = Math.floor(padId / 10);

    if (row === 1) {
      state.stokeIntensity = STOKE_BURST_INTENSITY;
      updateSimulation();
    }
  },
};

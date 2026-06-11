import type { App } from "../../types";
import { setRGB, clearGrid } from "../../core/grid";

type Rgb = [number, number, number];

const HOURS_RGB: Rgb = [0, 32, 127];
const MINUTES_RGB: Rgb = [0, 100, 20];
const SECONDS_RGB: Rgb = [110, 10, 0];

interface ClockState {
  clockInterval: NodeJS.Timeout | null;
}

const state: ClockState = {
  clockInterval: null,
};

const OUTER_RING_PADS = [
  85, 86, 87, 88, 78, 68, 58, 48, 38, 28, 18, 17, 16, 15, 14, 13, 12, 11, 21,
  31, 41, 51, 61, 71, 81, 82, 83, 84,
];

const INNER_RING_PADS = [
  75, 76, 77, 67, 57, 47, 37, 27, 26, 25, 24, 23, 22, 32, 42, 52, 62, 72, 73,
  74,
];

const CENTER_CORE_PADS = [65, 66, 56, 46, 36, 35, 34, 33, 43, 53, 63, 64];

interface TrackFill {
  activePadCount: number;
  rgb: Rgb;
}

function renderTrack(pads: readonly number[], fill: TrackFill): void {
  pads.slice(0, fill.activePadCount).forEach((padId) => {
    setRGB(padId, fill.rgb);
  });
  if (fill.activePadCount === 0) {
    pads.forEach((padId) => {
      setRGB(padId, [0, 0, 0]);
    });
  }
}

function hoursFractionOfDial(hours: number): number {
  return hours === 0 ? 12 : hours / 12;
}

function updateClock(): void {
  const now = new Date();
  const hours = now.getHours() % 12;
  const minutes = now.getMinutes();
  const seconds = now.getSeconds();

  renderTrack(OUTER_RING_PADS, {
    activePadCount: Math.ceil((seconds / 60) * OUTER_RING_PADS.length),
    rgb: SECONDS_RGB,
  });

  renderTrack(INNER_RING_PADS, {
    activePadCount: Math.ceil((minutes / 60) * INNER_RING_PADS.length),
    rgb: MINUTES_RGB,
  });

  renderTrack(CENTER_CORE_PADS, {
    activePadCount: Math.ceil(
      hoursFractionOfDial(hours) * CENTER_CORE_PADS.length
    ),
    rgb: HOURS_RGB,
  });
}

export const matrixClock: App = {
  name: "Matrix Dial Clock",

  init(): void {
    clearGrid();
    updateClock();
    state.clockInterval = setInterval(updateClock, 500);
  },

  cleanup(): void {
    if (state.clockInterval) {
      clearInterval(state.clockInterval);
      state.clockInterval = null;
    }
  },
};

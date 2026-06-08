import type { App } from "../../types";
import { setRGB, clearGrid } from "../../core/grid";
import { Output } from "webmidi";

// Soft, steady ambient colors (Restricted to 0-127 for Launchpad X)
const COLOR_HOURS = { r: 0, g: 32, b: 127 }; // Solid Blue Core
const COLOR_MINUTES = { r: 0, g: 100, b: 20 }; // Smooth Emerald Track
const COLOR_SECONDS = { r: 110, g: 10, b: 0 }; // Smooth Crimson Track

interface ClockState {
  clockInterval: NodeJS.Timeout | null;
}

const state: ClockState = {
  clockInterval: null,
};

// --- PRE-COMPUTED COORDINATE TRACKS FOR SMOOTH SWEEPS ---

// Outer border tracking clockwise starting from top-left (Row 8, Col 1)
const OUTER_RING_PADS = [
  85,
  86,
  87,
  88, // Top Row ->
  78,
  68,
  58,
  48,
  38,
  28,
  18, // Right Col |v
  17,
  16,
  15,
  14,
  13,
  12,
  11, // Bottom Row <-
  21,
  31,
  41,
  51,
  61,
  71, // Left Col |^
  81,
  82,
  83,
  84,
];

// Inner border tracking clockwise starting from row 7, col 2
const INNER_RING_PADS = [
  75,
  76,
  77, // Inner Top Row ->
  67,
  57,
  47,
  37, // Inner Right Col |v
  27,
  26,
  25,
  24,
  23,
  22, // Inner Bottom Row <-
  32,
  42,
  52,
  62, // Inner Left Col |^
  72,
  73,
  74,
];

// 16 Center pads filled from bottom to top rows cleanly
const CENTER_CORE_PADS = [65, 66, 56, 46, 36, 35, 34, 33, 43, 53, 63, 64];

function updateClock(): void {
  // Clear layout buffer before plotting frame state
  // clearGrid();

  const now = new Date();
  const hours = now.getHours() % 12; // 12-hour format fits the 16-pad core beautifully
  const minutes = now.getMinutes();
  const seconds = now.getSeconds();

  // 1. Map Seconds to Outer Ring (Linear scaling: 60 seconds mapped across 28 pads)
  const activeSecondsPads = Math.ceil((seconds / 60) * OUTER_RING_PADS.length);
  for (let i = 0; i < activeSecondsPads; i++) {
    const padId = OUTER_RING_PADS[i];
    setRGB(padId, COLOR_SECONDS.r, COLOR_SECONDS.g, COLOR_SECONDS.b);
  }
  if (activeSecondsPads === 0) {
    OUTER_RING_PADS.forEach((padId) => {
      setRGB(padId, 0, 0, 0);
    });
  }

  // 2. Map Minutes to Inner Ring (Linear scaling: 60 minutes mapped across 20 pads)
  const activeMinutesPads = Math.ceil((minutes / 60) * INNER_RING_PADS.length);
  for (let i = 0; i < activeMinutesPads; i++) {
    const padId = INNER_RING_PADS[i];
    setRGB(padId, COLOR_MINUTES.r, COLOR_MINUTES.g, COLOR_MINUTES.b);
  }
  if (activeMinutesPads === 0) {
    INNER_RING_PADS.forEach((padId) => {
      setRGB(padId, 0, 0, 0);
    });
  }

  // 3. Map Hours to Center Core (Linear scaling: 12 hours mapped across 16 pads)
  const activeHoursPads = Math.ceil(
    (hours === 0 ? 12 : hours / 12) * CENTER_CORE_PADS.length
  );
  for (let i = 0; i < activeHoursPads; i++) {
    const padId = CENTER_CORE_PADS[i];
    setRGB(padId, COLOR_HOURS.r, COLOR_HOURS.g, COLOR_HOURS.b);
  }
  if (activeHoursPads === 0) {
    CENTER_CORE_PADS.forEach((padId) => {
      setRGB(padId, 0, 0, 0);
    });
  }
}

export const matrixClock: App = {
  name: "Matrix Dial Clock",

  init(): void {
    clearGrid();
    updateClock();
    // 500ms updates ensure second step-transitions are caught instantly without jitter
    state.clockInterval = setInterval(updateClock, 500);
  },

  cleanup(): void {
    if (state.clockInterval) {
      clearInterval(state.clockInterval);
      state.clockInterval = null;
    }
  },
};

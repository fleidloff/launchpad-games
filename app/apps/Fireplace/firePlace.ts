import type { App } from "../../types";
import type { NoteMessageEvent } from "webmidi";
import { setRGB, clearGrid } from "../../grid";

const TICK_INTERVAL_MS = 140; // Slightly slower frame pacing for distinct pixel-art tracking

interface FireplaceState {
  heatGrid: number[][]; // Columns 1-8, Rows 0-7 internal
  simInterval: NodeJS.Timeout | null;
  stokeIntensity: number;
}

const state: FireplaceState = {
  heatGrid: Array.from({ length: 9 }, () => Array(8).fill(0)),
  simInterval: null,
  stokeIntensity: 0,
};

// --- STARK PIXEL ART BANDING COLOR PALETTE ---
function getPixelArtColor(heat: number): { r: number; g: number; b: number } {
  if (heat > 4.2) return { r: 127, g: 127, b: 110 }; // Blinding White-Hot Sparks
  if (heat > 2.8) return { r: 127, g: 115, b: 0 }; // Sharp Bright Yellow Core
  if (heat > 1.5) return { r: 127, g: 40, b: 0 }; // Rich Silhouette Orange
  if (heat > 0.5) return { r: 75, g: 5, b: 0 }; // Dark Ashy Red Tendrils
  return { r: 0, g: 0, b: 0 }; // Negative Space (Off)
}

function updateSimulation(): void {
  if (state.stokeIntensity > 0) {
    state.stokeIntensity -= 0.2;
  }

  // 1. Generate a Centered Fuel Bed Shapes (Pyramid Thermal Core Architecture)
  for (let col = 1; col <= 8; col++) {
    let baseHeat = 0;

    // Naturally feed more thermal energy to center columns to force a triangle/bonfire geometry
    if (col === 4 || col === 5) {
      baseHeat = 3.0 + Math.random() * 1.5;
    } else if (col === 3 || col === 6) {
      baseHeat = 1.8 + Math.random() * 1.0;
    } else if (col === 2 || col === 7) {
      baseHeat = 0.6 + Math.random() * 0.8;
    } else {
      baseHeat = 0.1 + Math.random() * 0.3; // Whispy edges
    }

    state.heatGrid[col][0] = baseHeat + Math.max(0, state.stokeIntensity);
  }

  // 2. Rising and Steeper Thermal Dissipation Math
  for (let row = 7; row >= 1; row--) {
    for (let col = 1; col <= 8; col++) {
      // Create sharp upward tearing artifacts by introducing intentional drift bias
      const randomFactor = Math.random();
      let sourceCol = col;

      if (randomFactor < 0.25) sourceCol = col - 1;
      else if (randomFactor > 0.75) sourceCol = col + 1;

      let sourceHeat = 0;
      if (sourceCol >= 1 && sourceCol <= 8) {
        sourceHeat = state.heatGrid[sourceCol][row - 1];
      } else {
        sourceHeat = state.heatGrid[col][row - 1];
      }

      // Cool the flanks much faster than the core to keep the fire tall and pointed
      let coolingRate = 0.45;
      if (col === 1 || col === 8 || col === 2 || col === 7) {
        coolingRate = 0.75; // Fast edge decay for floating sparks effect
      }

      state.heatGrid[col][row] = Math.max(0, sourceHeat - coolingRate);
    }
  }

  // 3. Render Pixel State Machine directly to Hardware Layout
  clearGrid();

  // Draw Stationary Pixel-Art Firewood Logs Base (Physical Row 1)
  const isStoked = state.stokeIntensity > 1.2;
  for (let col = 1; col <= 8; col++) {
    if (isStoked) {
      setRGB(10 + col, 127, 127, 80); // White-flash log ignite effect
    } else {
      // Classic pixel art logs: Dark outer ends, hot glowing embers in the middle
      if (col === 1 || col === 8) {
        setRGB(10 + col, 15, 6, 2); // Dark Charcoal Ends
      } else if (col === 2 || col === 7) {
        setRGB(10 + col, 35, 10, 2); // Warm Wood
      } else {
        // Deep pulsating glowing ember core
        const corePulse =
          55 + Math.floor(Math.sin(Date.now() / 150 + col) * 15);
        setRGB(10 + col, corePulse, 12, 0);
      }
    }
  }

  // Draw Upward Flame Vectors (Physical Rows 2 to 8)
  for (let row = 1; row <= 7; row++) {
    for (let col = 1; col <= 8; col++) {
      const heat = state.heatGrid[col][row];
      const color = getPixelArtColor(heat);
      const padId = (row + 1) * 10 + col;

      if (padId > 18) {
        setRGB(padId, color.r, color.g, color.b);
      }
    }
  }
}

export const fireplace: App = {
  name: "Tamagotchi Fireplace",

  init(): void {
    state.stokeIntensity = 0;
    state.heatGrid = Array.from({ length: 9 }, () => Array(8).fill(0));
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
      // Inject a bigger heat burst to make the flare look structural
      state.stokeIntensity = 4.8;
      updateSimulation();
    }
  },
};

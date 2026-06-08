import type { App } from "../../types";
import { setRGB, clearGrid } from "../../core/grid";

const LATITUDE = 53.94;
const LONGITUDE = 10.31;
const FETCH_INTERVAL_MS = 10 * 60 * 1000; // 10 minutes
const ANIMATION_TICK_MS = 400; // Speed of weather frame transitions

interface WeatherState {
  fetchInterval: NodeJS.Timeout | null;
  animInterval: NodeJS.Timeout | null;
  currentCode: number;
  animFrame: number;
}

const state: WeatherState = {
  fetchInterval: null,
  animInterval: null,
  currentCode: 0,
  animFrame: 0,
};

// --- COLOR PALETTE (Restricted to 0-127 for Launchpad X) ---
const YEL = { r: 127, g: 105, b: 0 }; // Sun Yellow
const DIM_YEL = { r: 60, g: 50, b: 0 }; // Dim Sun Yellow for pulsing
const BLU = { r: 0, g: 40, b: 127 }; // Rain Blue
const WHT = { r: 110, g: 110, b: 110 }; // Cloud White / Snow
const GRY = { r: 35, g: 35, b: 35 }; // Storm Cloud Dark Gray
const AMB = { r: 127, g: 80, b: 0 }; // Lightning Flash Amber
const AQU = { r: 0, g: 90, b: 90 }; // Wind / Fog Aqua
const OFF = { r: 0, g: 0, b: 0 }; // Off/Black Space

// --- ANIMATION FRAMES CONFIGURATION ---

const ANIM_SUNNY = [
  // Frame 0: Extended Rays
  [
    [OFF, OFF, OFF, YEL, YEL, OFF, OFF, OFF],
    [OFF, YEL, OFF, YEL, YEL, OFF, YEL, OFF],
    [OFF, OFF, YEL, YEL, YEL, YEL, OFF, OFF],
    [YEL, YEL, YEL, YEL, YEL, YEL, YEL, YEL],
    [YEL, YEL, YEL, YEL, YEL, YEL, YEL, YEL],
    [OFF, OFF, YEL, YEL, YEL, YEL, OFF, OFF],
    [OFF, YEL, OFF, YEL, YEL, OFF, YEL, OFF],
    [OFF, OFF, OFF, YEL, YEL, OFF, OFF, OFF],
  ],
  // Frame 1: Retracted/Pulsing Rays
  [
    [OFF, OFF, OFF, DIM_YEL, DIM_YEL, OFF, OFF, OFF],
    [OFF, DIM_YEL, OFF, YEL, YEL, OFF, DIM_YEL, OFF],
    [OFF, OFF, YEL, YEL, YEL, YEL, OFF, OFF],
    [DIM_YEL, YEL, YEL, YEL, YEL, YEL, YEL, DIM_YEL],
    [DIM_YEL, YEL, YEL, YEL, YEL, YEL, YEL, DIM_YEL],
    [OFF, OFF, YEL, YEL, YEL, YEL, OFF, OFF],
    [OFF, DIM_YEL, OFF, YEL, YEL, OFF, DIM_YEL, OFF],
    [OFF, OFF, OFF, DIM_YEL, DIM_YEL, OFF, OFF, OFF],
  ],
];

const ANIM_RAINY = [
  // Frame 0: Rain droplets high
  [
    [OFF, OFF, GRY, GRY, GRY, GRY, OFF, OFF],
    [OFF, GRY, GRY, GRY, GRY, GRY, GRY, OFF],
    [GRY, GRY, GRY, GRY, GRY, GRY, GRY, GRY],
    [GRY, GRY, GRY, GRY, GRY, GRY, GRY, GRY],
    [OFF, BLU, OFF, BLU, OFF, BLU, OFF, BLU],
    [OFF, OFF, OFF, OFF, OFF, OFF, OFF, OFF],
    [BLU, OFF, BLU, OFF, BLU, OFF, BLU, OFF],
    [OFF, OFF, OFF, OFF, OFF, OFF, OFF, OFF],
  ],
  // Frame 1: Rain droplets falling lower
  [
    [OFF, OFF, GRY, GRY, GRY, GRY, OFF, OFF],
    [OFF, GRY, GRY, GRY, GRY, GRY, GRY, OFF],
    [GRY, GRY, GRY, GRY, GRY, GRY, GRY, GRY],
    [GRY, GRY, GRY, GRY, GRY, GRY, GRY, GRY],
    [OFF, OFF, OFF, OFF, OFF, OFF, OFF, OFF],
    [OFF, BLU, OFF, BLU, OFF, BLU, OFF, BLU],
    [OFF, OFF, OFF, OFF, OFF, OFF, OFF, OFF],
    [BLU, OFF, BLU, OFF, BLU, OFF, BLU, OFF],
  ],
];

const ANIM_THUNDER = [
  // Frame 0: Storm cloud charging
  [
    [OFF, OFF, GRY, GRY, GRY, GRY, OFF, OFF],
    [OFF, GRY, GRY, GRY, GRY, GRY, GRY, OFF],
    [GRY, GRY, GRY, GRY, GRY, GRY, GRY, GRY],
    [GRY, GRY, GRY, GRY, GRY, GRY, GRY, GRY],
    [OFF, OFF, OFF, OFF, OFF, BLU, OFF, OFF],
    [OFF, OFF, OFF, OFF, OFF, OFF, BLU, OFF],
    [OFF, OFF, OFF, OFF, OFF, BLU, OFF, OFF],
    [OFF, OFF, OFF, OFF, OFF, OFF, OFF, OFF],
  ],
  // Frame 1: Bolt strikes down
  [
    [OFF, OFF, GRY, GRY, GRY, GRY, OFF, OFF],
    [OFF, GRY, GRY, GRY, GRY, GRY, GRY, OFF],
    [GRY, GRY, GRY, GRY, GRY, GRY, GRY, GRY],
    [GRY, GRY, GRY, GRY, GRY, GRY, GRY, GRY],
    [OFF, OFF, AMB, AMB, OFF, BLU, OFF, OFF],
    [OFF, AMB, AMB, OFF, OFF, OFF, BLU, OFF],
    [OFF, OFF, AMB, OFF, OFF, BLU, OFF, OFF],
    [OFF, AMB, OFF, OFF, OFF, OFF, OFF, OFF],
  ],
];

const ANIM_WINDY = [
  // Frame 0: Gusts moving left
  [
    [OFF, OFF, OFF, OFF, OFF, OFF, OFF, OFF],
    [OFF, AQU, AQU, AQU, AQU, AQU, OFF, OFF],
    [OFF, OFF, OFF, OFF, OFF, AQU, AQU, OFF],
    [OFF, AQU, AQU, AQU, AQU, AQU, OFF, OFF],
    [OFF, OFF, OFF, OFF, AQU, AQU, OFF, OFF],
    [OFF, AQU, AQU, AQU, AQU, OFF, OFF, OFF],
    [OFF, OFF, OFF, OFF, OFF, OFF, OFF, OFF],
    [OFF, OFF, OFF, OFF, OFF, OFF, OFF, OFF],
  ],
  // Frame 1: Gusts shifted right
  [
    [OFF, OFF, OFF, OFF, OFF, OFF, OFF, OFF],
    [OFF, OFF, AQU, AQU, AQU, AQU, AQU, OFF],
    [OFF, OFF, OFF, OFF, OFF, OFF, AQU, AQU],
    [OFF, OFF, AQU, AQU, AQU, AQU, AQU, OFF],
    [OFF, OFF, OFF, OFF, OFF, AQU, AQU, OFF],
    [OFF, OFF, AQU, AQU, AQU, AQU, OFF, OFF],
    [OFF, OFF, OFF, OFF, OFF, OFF, OFF, OFF],
    [OFF, OFF, OFF, OFF, OFF, OFF, OFF, OFF],
  ],
];

// Fallback arrays for stationary layouts (wrapping single-frame maps inside an array)
const ANIM_CLOUDY = [
  [
    [OFF, OFF, OFF, OFF, OFF, OFF, OFF, OFF],
    [OFF, OFF, OFF, WHT, WHT, OFF, OFF, OFF],
    [OFF, OFF, WHT, WHT, WHT, WHT, OFF, OFF],
    [OFF, WHT, WHT, WHT, WHT, WHT, WHT, OFF],
    [WHT, WHT, WHT, WHT, WHT, WHT, WHT, WHT],
    [WHT, WHT, WHT, WHT, WHT, WHT, WHT, WHT],
    [OFF, OFF, OFF, OFF, OFF, OFF, OFF, OFF],
    [OFF, OFF, OFF, OFF, OFF, OFF, OFF, OFF],
  ],
];

const ANIM_FOGGY = [
  [
    [OFF, OFF, OFF, OFF, OFF, OFF, OFF, OFF],
    [AQU, AQU, AQU, AQU, AQU, AQU, AQU, AQU],
    [OFF, OFF, OFF, OFF, OFF, OFF, OFF, OFF],
    [OFF, AQU, AQU, AQU, AQU, AQU, AQU, OFF],
    [OFF, OFF, OFF, OFF, OFF, OFF, OFF, OFF],
    [OFF, OFF, AQU, AQU, AQU, AQU, OFF, OFF],
    [OFF, OFF, OFF, OFF, OFF, OFF, OFF, OFF],
    [AQU, AQU, AQU, AQU, AQU, AQU, AQU, AQU],
  ],
];

function getActiveAnimationSet(wmoCode: number): typeof ANIM_SUNNY {
  if (wmoCode === 0 || wmoCode === 1) return ANIM_SUNNY;
  if (wmoCode === 2 || wmoCode === 3) return ANIM_CLOUDY;
  if (wmoCode === 45 || wmoCode === 48) return ANIM_FOGGY;
  if (wmoCode >= 51 && wmoCode <= 67) return ANIM_RAINY;
  if (wmoCode >= 71 && wmoCode <= 86) return ANIM_RAINY; // Re-use rainy drop cycle vectors for snow speed drops
  if (wmoCode >= 95 && wmoCode <= 99) return ANIM_THUNDER;
  return ANIM_WINDY;
}

function renderAnimationFrame(): void {
  const currentSet = getActiveAnimationSet(state.currentCode);

  // Clean loop over frames safely using length limits
  const frameIndex = state.animFrame % currentSet.length;
  const currentMatrix = currentSet[frameIndex];

  //clearGrid();
  for (let r = 0; r < 8; r++) {
    for (let c = 0; c < 8; c++) {
      const color = currentMatrix[r][c];
      const padId = (8 - r) * 10 + (c + 1);
      setRGB(padId, color.r, color.g, color.b);
    }
  }

  state.animFrame++;
}

async function fetchLiveWeather(): Promise<void> {
  try {
    const response = await fetch(
      `https://api.open-meteo.com/v1/forecast?latitude=${LATITUDE}&longitude=${LONGITUDE}&current_weather=true`
    );
    const data = await response.json();
    if (data?.current_weather?.weathercode !== undefined) {
      state.currentCode = data.current_weather.weathercode;
    }
  } catch (error) {
    console.error("Failed fetching animation telemetry matrices:", error);
  }
}

export const weatherStation: App = {
  name: "Animated Weather",

  init(): void {
    state.animFrame = 0;

    // Initial fetch, then pull fresh data every 10 minutes
    fetchLiveWeather();
    state.fetchInterval = setInterval(fetchLiveWeather, FETCH_INTERVAL_MS);

    // Drive the 8x8 matrix display ticks locally via separate game-loop timing configurations
    state.animInterval = setInterval(renderAnimationFrame, ANIMATION_TICK_MS);
  },

  cleanup(): void {
    if (state.fetchInterval) clearInterval(state.fetchInterval);
    if (state.animInterval) clearInterval(state.animInterval);
    state.fetchInterval = null;
    state.animInterval = null;
  },
};

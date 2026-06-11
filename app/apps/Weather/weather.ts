import type { App } from "../../types";
import { setRGB } from "../../core/grid";

const LATITUDE = 53.94;
const LONGITUDE = 10.31;
const FETCH_INTERVAL_MS = 10 * 60 * 1000;
const ANIMATION_TICK_MS = 400;

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

interface PadColor {
  r: number;
  g: number;
  b: number;
}

const YEL: PadColor = { r: 127, g: 105, b: 0 };
const DIM_YEL: PadColor = { r: 60, g: 50, b: 0 };
const BLU: PadColor = { r: 0, g: 40, b: 127 };
const WHT: PadColor = { r: 110, g: 110, b: 110 };
const GRY: PadColor = { r: 35, g: 35, b: 35 };
const AMB: PadColor = { r: 127, g: 80, b: 0 };
const AQU: PadColor = { r: 0, g: 90, b: 90 };
const OFF: PadColor = { r: 0, g: 0, b: 0 };

const ANIM_SUNNY: PadColor[][][] = [
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

const ANIM_RAINY: PadColor[][][] = [
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

const ANIM_THUNDER: PadColor[][][] = [
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

const ANIM_WINDY: PadColor[][][] = [
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

const ANIM_CLOUDY: PadColor[][][] = [
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

const ANIM_FOGGY: PadColor[][][] = [
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

interface WmoCodeRange {
  min: number;
  max: number;
  frames: PadColor[][][];
}

const WMO_CODE_ANIMATIONS: WmoCodeRange[] = [
  { min: 0, max: 1, frames: ANIM_SUNNY },
  { min: 2, max: 3, frames: ANIM_CLOUDY },
  { min: 45, max: 45, frames: ANIM_FOGGY },
  { min: 48, max: 48, frames: ANIM_FOGGY },
  { min: 51, max: 67, frames: ANIM_RAINY },
  { min: 71, max: 86, frames: ANIM_RAINY },
  { min: 95, max: 99, frames: ANIM_THUNDER },
];

function getActiveAnimationSet(wmoCode: number): PadColor[][][] {
  const match = WMO_CODE_ANIMATIONS.find(
    (range) => wmoCode >= range.min && wmoCode <= range.max
  );
  return match?.frames ?? ANIM_WINDY;
}

function paintRow(row: PadColor[], rowIndex: number): void {
  row.forEach((color, colIndex) => {
    const padId = (8 - rowIndex) * 10 + (colIndex + 1);
    setRGB(padId, [color.r, color.g, color.b]);
  });
}

function renderAnimationFrame(): void {
  const currentSet = getActiveAnimationSet(state.currentCode);
  const frameIndex = state.animFrame % currentSet.length;
  const currentMatrix = currentSet[frameIndex];

  currentMatrix?.forEach(paintRow);

  state.animFrame++;
}

interface WeatherApiResponse {
  current_weather?: {
    weathercode?: number;
  };
}

async function fetchLiveWeather(): Promise<void> {
  try {
    const response = await fetch(
      `https://api.open-meteo.com/v1/forecast?latitude=${LATITUDE}&longitude=${LONGITUDE}&current_weather=true`
    );
    const data = (await response.json()) as WeatherApiResponse;
    const weathercode = data.current_weather?.weathercode;
    if (weathercode !== undefined) {
      state.currentCode = weathercode;
    }
  } catch (error) {
    console.error("Failed fetching animation telemetry matrices:", error);
  }
}

export const weatherStation: App = {
  name: "Animated Weather",

  init(): void {
    state.animFrame = 0;

    void fetchLiveWeather();
    state.fetchInterval = setInterval(fetchLiveWeather, FETCH_INTERVAL_MS);

    state.animInterval = setInterval(renderAnimationFrame, ANIMATION_TICK_MS);
  },

  cleanup(): void {
    if (state.fetchInterval) clearInterval(state.fetchInterval);
    if (state.animInterval) clearInterval(state.animInterval);
    state.fetchInterval = null;
    state.animInterval = null;
  },
};

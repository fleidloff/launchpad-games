export type RGB = [number, number, number];
export type FlashingState = {
  r: number;
  g: number;
  b: number;
  duration: number; // Duration of one full cycle in ms
  startTime: number;
};

export type Color = number | RGB | FlashingState;

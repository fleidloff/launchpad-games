import { lpOutput } from "./midi";
import { 
  NOVATION_ID, 
  LAUNCHPAD_X_ID, 
  CMD_API_SUB_ID, 
  CMD_LED_CONTROL, 
  LIGHTING_RGB
} from "./constants";
import type { Color, RGB, FlashingState } from "./types";

const launchpadState: Record<number, Color> = {};
let animationFrameId: number | null = null;

// Initialize all possible pads (11 to 99) to 0 (off)
for (let i = 11; i <= 99; i++) {
  launchpadState[i] = 0;
}

export function enterProgrammerMode(): void {
  if (!lpOutput) return;
  // [Manufacturer ID, Device ID, Command, Mode (03 = Programmer)]
  lpOutput.sendSysex(NOVATION_ID, [LAUNCHPAD_X_ID, CMD_API_SUB_ID, 0x0e, 0x03]);
}

function sendRGB(padId: number, r: number, g: number, b: number): void {
  if (!lpOutput) return;

  const rawMessage = [
    0xf0, // SysEx Start
    ...NOVATION_ID,
    LAUNCHPAD_X_ID,
    CMD_API_SUB_ID,
    CMD_LED_CONTROL,
    LIGHTING_RGB,
    padId, // On Launchpad X Programmer Mode, the LED index matches the Note/CC number
    r,
    g,
    b,
    0xf7, // SysEx End
  ];

  lpOutput.send(rawMessage);
}


export function setRGB(
  padId: number,
  r: number = 0,
  g: number = 0,
  b: number = 0
): void {
  launchpadState[padId] = [r, g, b];
  sendRGB(padId, r, g, b);
  checkAnimationLoop();
}

export function setRGBFlashing(
  padId: number,
  r: number,
  g: number,
  b: number,
  duration: number = 1500
): void {
  launchpadState[padId] = {
    r,
    g,
    b,
    duration,
    startTime: performance.now(),
  };
  checkAnimationLoop();
}

function checkAnimationLoop(): void {
  const hasFlashing = Object.values(launchpadState).some(
    (c) => typeof c === "object" && !Array.isArray(c)
  );

  if (hasFlashing && animationFrameId === null) {
    animationFrameId = requestAnimationFrame(updateAnimation);
  } else if (!hasFlashing && animationFrameId !== null) {
    cancelAnimationFrame(animationFrameId);
    animationFrameId = null;
  }
}

function updateAnimation(time: number): void {
  let hasFlashing = false;

  for (const [padIdStr, color] of Object.entries(launchpadState)) {
    if (typeof color === "object" && !Array.isArray(color)) {
      hasFlashing = true;
      const padId = parseInt(padIdStr);
      const state = color as FlashingState;

      // Calculate oscillation (0 to 1 and back to 0)
      // Using a triangle wave for "smooth" but linear flashing
      // Or sine wave for even smoother:
      const phase =
        ((time - state.startTime) % state.duration) / state.duration;
      const intensity = (Math.sin(phase * Math.PI * 2 - Math.PI / 2) + 1) / 2;

      const currR = Math.round(state.r * intensity);
      const currG = Math.round(state.g * intensity);
      const currB = Math.round(state.b * intensity);

      sendRGB(padId, currR, currG, currB);
    }
  }

  if (hasFlashing) {
    animationFrameId = requestAnimationFrame(updateAnimation);
  } else {
    animationFrameId = null;
  }
}

export function clearGrid(): void {
  for (let i = 11; i <= 99; i++) {
    setRGB(i);
  }
}

export function getColor(padId: number): RGB | null {
  const color = launchpadState[padId];

  if (Array.isArray(color)) {
    const [r, g, b] = color;
    if (r === 0 && g === 0 && b === 0) return null;
    return [r, g, b];
  }

  if (typeof color === "object" && color !== null) {
    const { r, g, b } = color as FlashingState;
    // Even if currently flashing to 0, we return the target color
    return [r, g, b];
  }

  return null;
}

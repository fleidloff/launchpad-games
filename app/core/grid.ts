import { lpOutput } from "./midi";
import {
  NOVATION_ID,
  LAUNCHPAD_X_ID,
  CMD_API_SUB_ID,
  CMD_LED_CONTROL,
  LIGHTING_RGB
} from "./constants";
import type { Color, RGB } from "../types";

export type FlashOptions = {
  rgb: RGB;
  duration?: number;
};

const DEFAULT_FLASH_DURATION = 1500;
const SYSEX_START = 0xf0;
const SYSEX_END = 0xf7;
const PROGRAMMER_MODE = [LAUNCHPAD_X_ID, CMD_API_SUB_ID, 0x0e, 0x03];
const FIRST_PAD = 11;
const LAST_PAD = 99;
const MAX_RGB_VALUE = 127;

const launchpadState: Record<number, Color> = {};
let animationFrameId: number | null = null;
const PROTECTED_PADS = [19, 29, 39, 49, 59, 69, 79, 89];

function isProtected(padId: number): boolean {
  return PROTECTED_PADS.includes(padId);
}

for (let i = FIRST_PAD; i <= LAST_PAD; i++) {
  launchpadState[i] = 0;
}

export function enterProgrammerMode(): void {
  if (!lpOutput) return;
  lpOutput.sendSysex(NOVATION_ID, PROGRAMMER_MODE);
}

function clampToMidiRange(v: number): number {
  const rounded = Math.round(v);
  return rounded < 0 ? 0 : (rounded > MAX_RGB_VALUE ? MAX_RGB_VALUE : rounded);
}

function sendRGB(padId: number, rgb: RGB): void {
  if (!lpOutput) return;

  const [r, g, b] = rgb;
  const rawMessage = [
    SYSEX_START,
    ...NOVATION_ID,
    LAUNCHPAD_X_ID,
    CMD_API_SUB_ID,
    CMD_LED_CONTROL,
    LIGHTING_RGB,
    padId,
    clampToMidiRange(r),
    clampToMidiRange(g),
    clampToMidiRange(b),
    SYSEX_END,
  ];

  lpOutput.send(rawMessage);
}

export function setRGB(padId: number, rgb: RGB = [0, 0, 0]): void {
  if (isProtected(padId)) return;
  setRGBInternal(padId, rgb);
}

export function setRGBFlashing(padId: number, flash: FlashOptions): void {
  if (isProtected(padId)) return;
  setRGBFlashingInternal(padId, flash);
}

export function setMenuRGB(padId: number, rgb: RGB = [0, 0, 0]): void {
  setRGBInternal(padId, rgb);
}

export function setMenuRGBFlashing(padId: number, flash: FlashOptions): void {
  setRGBFlashingInternal(padId, flash);
}

function setRGBInternal(padId: number, rgb: RGB = [0, 0, 0]): void {
  launchpadState[padId] = rgb;
  sendRGB(padId, rgb);
  checkAnimationLoop();
}

function setRGBFlashingInternal(padId: number, flash: FlashOptions): void {
  const [r, g, b] = flash.rgb;
  launchpadState[padId] = {
    r,
    g,
    b,
    duration: flash.duration ?? DEFAULT_FLASH_DURATION,
    startTime: performance.now(),
  };
  checkAnimationLoop();
}

function isFlashing(color: Color): boolean {
  return typeof color === "object" && !Array.isArray(color);
}

function checkAnimationLoop(): void {
  const hasFlashing = Object.values(launchpadState).some(isFlashing);

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

      const phase =
        ((time - color.startTime) % color.duration) / color.duration;
      const intensity = (Math.sin(phase * Math.PI * 2 - Math.PI / 2) + 1) / 2;

      sendRGB(padId, [
        Math.round(color.r * intensity),
        Math.round(color.g * intensity),
        Math.round(color.b * intensity),
      ]);
    }
  }

  if (hasFlashing) {
    animationFrameId = requestAnimationFrame(updateAnimation);
  } else {
    animationFrameId = null;
  }
}

export function clearGrid(): void {
  for (let i = FIRST_PAD; i <= LAST_PAD; i++) {
    if (!isProtected(i)) {
      setRGBInternal(i);
    }
  }
}

function isOff([r, g, b]: RGB): boolean {
  return r === 0 && g === 0 && b === 0;
}

export function getColor(padId: number): RGB | null {
  const color = launchpadState[padId];

  if (typeof color === "number" || color === undefined) return null;

  if (!Array.isArray(color)) {
    return [color.r, color.g, color.b];
  }

  return isOff(color) ? null : [...color];
}

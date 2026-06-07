import { lpOutput } from "./midi";
import { 
  NOVATION_ID, 
  LAUNCHPAD_X_ID, 
  CMD_API_SUB_ID, 
  CMD_LED_CONTROL, 
  LIGHTING_RGB,
  PAD_TO_SYSEX
} from "./constants";
import type { Color } from "./types";

const launchpadState: Record<number, Color> = {};

// Initialize all possible pads (11 to 99) to 0 (off)
for (let i = 11; i <= 99; i++) {
  launchpadState[i] = 0;
}

export function enterProgrammerMode(): void {
  if (!lpOutput) return;
  // [Manufacturer ID, Device ID, Command, Mode (03 = Programmer)]
  lpOutput.sendSysex(NOVATION_ID, [LAUNCHPAD_X_ID, CMD_API_SUB_ID, 0x0e, 0x03]);
}

export function setRGB(
  padId: number,
  r: number = 0,
  g: number = 0,
  b: number = 0
): void {
  if (!lpOutput) return;
  launchpadState[padId] = [r, g, b];

  let sysExIndex = PAD_TO_SYSEX[padId] ?? padId;

  const rawMessage = [
    0xf0, // SysEx Start
    ...NOVATION_ID,
    LAUNCHPAD_X_ID,
    CMD_API_SUB_ID,
    CMD_LED_CONTROL,
    LIGHTING_RGB,
    sysExIndex,
    r,
    g,
    b,
    0xf7, // SysEx End
  ];

  lpOutput.send(rawMessage);
}

export function clearGrid(): void {
  if (!lpOutput) return;
  for (let i = 11; i <= 99; i++) {
    setRGB(i);
  }
}

export function getColor(padId: number): [number, number, number] | null {
  const color = launchpadState[padId];
  if (Array.isArray(color)) {
    const [r, g, b] = color;
    if (r === 0 && g === 0 && b === 0) return null;
    return [r, g, b];
  }
  return null;
}

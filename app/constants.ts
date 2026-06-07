export const NOVATION_ID = [0x00, 0x20, 0x29];
export const LAUNCHPAD_X_ID = 0x02;
export const CMD_API_SUB_ID = 0x0c;
export const CMD_LED_CONTROL = 0x03;
export const LIGHTING_RGB = 0x03;

export const PAD_TO_SYSEX: Record<number, number> = {
  99: 1, // Up Arrow
  91: 2, // Down Arrow
  92: 3, // Left Arrow
  93: 4, // Right Arrow
  94: 5, // Session
  95: 6, // Note
  96: 7, // Custom
  97: 8, // Volume
  98: 9, // Pan
  89: 19, // Novation Logo
};

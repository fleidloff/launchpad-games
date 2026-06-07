import { WebMidi } from "webmidi";
import type { Input, Output, NoteMessageEvent } from "webmidi";

let lpInput: Input | undefined = undefined;
let lpOutput: Output | undefined = undefined;

// Initialize WebMidi
WebMidi.enable({ sysex: true }) // SysEx is REQUIRED to switch Launchpad modes
  .then(onEnabled)
  .catch((err: Error) => {
    const statusDiv = document.getElementById("status");
    if (statusDiv) {
      statusDiv.innerText = "Web MIDI not supported/allowed.";
    }
    console.error(err);
  });

function onEnabled(): void {
  // Watch for device connections/disconnections
  WebMidi.addListener("connected", checkDevices);
  WebMidi.addListener("disconnected", checkDevices);
  checkDevices();
}

// A safety flag to prevent spamming the Launchpad with commands
let isInitialized = false;

function checkDevices(): void {
  lpInput = WebMidi.inputs.find((i) => i.name.includes("Launchpad X"));
  lpOutput = WebMidi.outputs.find((o) => o.name.includes("Launchpad X"));

  const statusDiv = document.getElementById("status");

  if (lpInput && lpOutput) {
    if (statusDiv) {
      statusDiv.innerText = "Launchpad X Connected!";
      statusDiv.className = "connected";
    }

    // Only initialize if we haven't already done so for this session
    if (!isInitialized) {
      // A tiny 100ms timeout gives the hardware a split second
      // to clear its throat after a browser page refresh
      setTimeout(() => {
        initLaunchpad();
        isInitialized = true;
      }, 100);
    }
  } else {
    if (statusDiv) {
      statusDiv.innerText = "Launchpad X Not Found";
      statusDiv.className = "disconnected";
    }
    isInitialized = false; // Reset flag so it can re-init if replugged
  }
}

// A simple object where the key is the Pad ID (e.g., 11) and the value is the Color Code (0-127) or RGB array
type Color = number | [number, number, number];
const launchpadState: Record<number, Color> = {};

// Initialize all possible pads (11 to 99) to 0 (off)
for (let i = 11; i <= 99; i++) {
  launchpadState[i] = 0;
}

function initLaunchpad(): void {
  if (!lpOutput || !lpInput) return;

  // 1. Enter Programmer Mode (SysEx sequence from Novation's Spec)
  // [Manufacturer ID, Device ID, Command, Mode (03 = Programmer)]
  lpOutput.sendSysex([0x00, 0x20, 0x29], [0x02, 0x0c, 0x0e, 0x03]);

  // 2. Clear any lingering LEDs
  clearGrid();

  // 3. Listen for Pad Presses
  // Launchpad X uses 'noteon' for the 8x8 grid and 'controlchange' for top/side buttons
  lpInput.removeListener(); // Clear old listeners if re-connecting

  lpInput.addListener("noteon", (e: NoteMessageEvent) => {
    const padId = e.note.number;
    const velocity = e.note.rawAttack; // How hard it was pressed (0-127)

    if (velocity > 0) {
      handlePadPress(padId, velocity);
    }
  });

  setRGB(99);
}

function setRGB(
  padId: number,
  r: number = 0,
  g: number = 0,
  b: number = 0
): void {
  if (!lpOutput) return;
  launchpadState[padId] = [r, g, b];

  // 1. Map standard button positions to internal SysEx indices
  let sysExIndex = padId;
  if (padId === 99) sysExIndex = 1; // Up Arrow
  if (padId === 91) sysExIndex = 2; // Down Arrow
  if (padId === 92) sysExIndex = 3; // Left Arrow
  if (padId === 93) sysExIndex = 4; // Right Arrow
  if (padId === 94) sysExIndex = 5; // Session
  if (padId === 95) sysExIndex = 6; // Note
  if (padId === 96) sysExIndex = 7; // Custom
  if (padId === 97) sysExIndex = 8; // Volume
  if (padId === 98) sysExIndex = 9; // Pan
  if (padId === 89) sysExIndex = 19; // Novation Logo

  // 2. Build the exact Novation SysEx spec structure
  const rawMessage = [
    0xf0, // SysEx Start
    0x00,
    0x20,
    0x29, // Novation Manufacturer ID
    0x02, // Device ID (Launchpad X Spec)
    0x0c, // Launchpad X Command API Sub-ID
    0x03, // Base Command: LED Control Mode

    // --- THE MISSING LAYER ---
    0x03, // Lighting Type (0x03 explicitly means "Raw RGB Mode")

    sysExIndex, // Hardware Pad Index Location
    r, // Red Intensity (0 to 127)
    g, // Green Intensity (0 to 127)
    b, // Blue Intensity (0 to 127)

    0xf7, // SysEx End
  ];

  // Fire it over the raw connection
  lpOutput.send(rawMessage);
}

// Helper: Clear entire grid
function clearGrid(): void {
  if (!lpOutput) return;
  for (let i = 11; i <= 99; i++) {
    setRGB(i); // 0 turns LED off
  }
}

function getColor(padId: number): [number, number, number] | null {
  const color = launchpadState[padId];
  if (Array.isArray(color)) {
    const [r, g, b] = color;
    if (r === 0 && g === 0 && b === 0) return null;
    return [r, g, b];
  }
  return null;
}

// Basic Game Logic Entrypoint
function handlePadPress(padId: number, velocity: number): void {
  console.log(`Pressed pad: ${padId}`);

  const currentColor = getColor(padId);

  if (currentColor === null) {
    console.log(`Pad ${padId} was OFF. Turning it Green.`);
    setRGB(padId, 0, velocity, 0);
  } else {
    console.log(
      `Pad ${padId} was already ON (Color: ${currentColor}). Turning it OFF.`
    );
    setRGB(padId, 0, 0, 0); // 0 = Off
  }
}

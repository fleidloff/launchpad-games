import { initMidi, lpInput } from "./midi";
import {
  enterProgrammerMode,
  clearGrid,
  setRGB,
  getColor,
  setRGBFlashing,
} from "./grid";
import type { NoteMessageEvent, ControlChangeMessageEvent } from "webmidi";

async function startApp() {
  await initMidi(() => {
    setupLaunchpad();
  });
}

function setupLaunchpad() {
  if (!lpInput) return;

  enterProgrammerMode();
  clearGrid();

  lpInput.removeListener();

  // Grid pads (11-88)
  lpInput.addListener("noteon", (e: NoteMessageEvent) => {
    const padId = e.note.number;
    const velocity = e.note.rawAttack;

    if (velocity > 0) {
      handlePadPress(padId, velocity);
    }
  });

  // Top row (91-99) and side buttons (19, 29, 39, etc.)
  lpInput.addListener("controlchange", (e: ControlChangeMessageEvent) => {
    const padId = e.controller.number;
    const velocity = e.message.data[2]; // Raw MIDI value

    if (velocity > 0) {
      handlePadPress(padId, velocity);
    }
  });

  setRGB(99, 10, 127, 10); // Light up Up arrow to show we are ready
}

export function handlePadPress(padId: number, velocity: number): void {
  console.log(`Pressed pad: ${padId}`);

  const currentColor = getColor(padId);

  if (currentColor === null) {
    console.log(`Pad ${padId} was OFF. Turning it Green.`);
    setRGB(padId, 0, velocity, 0);
  } else {
    console.log(
      `Pad ${padId} was already ON (Color: ${currentColor}). Turning it OFF.`
    );
    setRGB(padId, 0, 0, 0);
  }
}

startApp();

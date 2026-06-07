import { initMidi, lpInput } from "./midi";
import {
  enterProgrammerMode,
  clearGrid,
  setRGB,
  getColor,
  setRGBFlashing,
} from "./grid";
import type { NoteMessageEvent } from "webmidi";

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
  lpInput.addListener("noteon", (e: NoteMessageEvent) => {
    const padId = e.note.number;
    const velocity = e.note.rawAttack;

    if (velocity > 0) {
      handlePadPress(padId, velocity);
    }
  });

  setRGB(99, 21, 0, 0); // Light up Up arrow to show we are ready
}

export function handlePadPress(padId: number, velocity: number): void {
  console.log(`Pressed pad: ${padId}`);

  const currentColor = getColor(padId);

  if (currentColor === null) {
    console.log(`Pad ${padId} was OFF. Turning it Green.`);
    setRGBFlashing(padId, 0, velocity, 0);
  } else {
    console.log(
      `Pad ${padId} was already ON (Color: ${currentColor}). Turning it OFF.`
    );
    setRGB(padId, 0, 0, 0);
  }
}

startApp();

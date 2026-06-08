import { setRGB, getColor } from "../../core/grid";
import type { App } from "../../types";
import type { NoteMessageEvent, ControlChangeMessageEvent } from "webmidi";

export function handlePadPress(padId: number, velocity: number): void {
  console.log(`[BasicButtons] Pressed pad: ${padId}`);

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

export const basicButtonsApp: App = {
  name: "Basic Buttons",

  init(): void {
    setRGB(99, 100, 100, 10); // Light up Up arrow to show we are ready
  },

  onNoteOn(e: NoteMessageEvent): void {
    const padId = e.note.number;
    const velocity = e.note.rawAttack;

    if (velocity > 0) {
      handlePadPress(padId, velocity);
    }
  },

  onControlChange(e: ControlChangeMessageEvent): void {
    const padId = e.controller.number;
    const velocity = e.message.data[2] || 0;

    if (velocity > 0) {
      handlePadPress(padId, velocity);
    }
  }
};

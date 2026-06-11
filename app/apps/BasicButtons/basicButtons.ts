import { setRGB, getColor } from "../../core/grid";
import type { App } from "../../types";
import type { NoteMessageEvent, ControlChangeMessageEvent } from "webmidi";

export function handlePadPress(padId: number, velocity: number): void {
  const currentColor = getColor(padId);

  if (currentColor === null) {
    setRGB(padId, [0, velocity, 0]);
  } else {
    setRGB(padId, [0, 0, 0]);
  }
}

export const basicButtonsApp: App = {
  name: "Basic Buttons",

  init(): void {
    setRGB(99, [100, 100, 10]);
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

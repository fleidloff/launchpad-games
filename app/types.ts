import type { NoteMessageEvent, ControlChangeMessageEvent } from "webmidi";

export type RGB = [number, number, number];
export type FlashingState = {
  r: number;
  g: number;
  b: number;
  duration: number;
  startTime: number;
};

export type Color = number | RGB | FlashingState;

export interface App {
  name: string;
  init(): void;
  cleanup?(): void;
  onNoteOn?(e: NoteMessageEvent): void;
  onNoteOff?(e: NoteMessageEvent): void;
  onControlChange?(e: ControlChangeMessageEvent): void;
  onNoteOnLongPress?(e: NoteMessageEvent): void;
  onControlChangeLongPress?(e: ControlChangeMessageEvent): void;
}

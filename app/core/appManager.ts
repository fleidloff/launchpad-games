import { lpInput } from "./midi";
import {
  enterProgrammerMode,
  clearGrid,
  setMenuRGB,
  setMenuRGBFlashing,
} from "./grid";
import type { App } from "../types";
import type { NoteMessageEvent, ControlChangeMessageEvent } from "webmidi";

type TimerId = ReturnType<typeof setTimeout>;

const LONG_PRESS_MS = 400;
const MENU_HOLD_MS = 1500;
const MENU_HOLD_FLASH_DURATION = 300;
const ACTIVE_MENU_COLOR: [number, number, number] = [0, 127, 0];
const INACTIVE_MENU_COLOR: [number, number, number] = [20, 20, 20];
const OFF_COLOR: [number, number, number] = [0, 0, 0];

export class AppManager {
  private apps: Map<number, App> = new Map();
  private activeApp: App | null = null;
  private activePadId: number | null = null;
  private holdTimers: Map<number, TimerId> = new Map();
  private notePressTimers: Map<number, { timer: TimerId; event: NoteMessageEvent }> = new Map();
  private noteLongPressed: Set<number> = new Set();
  private ccPressTimers: Map<number, { timer: TimerId; event: ControlChangeMessageEvent }> = new Map();
  private ccLongPressed: Set<number> = new Set();

  registerApp(padId: number, app: App): void {
    this.apps.set(padId, app);
  }

  init(): void {
    if (!lpInput) return;

    enterProgrammerMode();
    lpInput.removeListener();

    lpInput.addListener("noteon", (e) => this.handleNoteOn(e));
    lpInput.addListener("noteoff", (e) => this.handleNoteOff(e));
    lpInput.addListener("controlchange", (e) => this.handleControlChange(e));

    const firstPad = Array.from(this.apps.keys())[0];
    if (firstPad) {
      this.switchApp(firstPad);
    }
  }

  switchApp(padId: number): void {
    const nextApp = this.apps.get(padId);
    if (!nextApp) return;

    this.clearLongPressTimers();

    if (this.activeApp?.cleanup) {
      this.activeApp.cleanup();
    }

    this.activeApp = nextApp;
    this.activePadId = padId;

    clearGrid();
    this.drawMenuButtons();
    this.activeApp.init();
  }

  private drawMenuButtons(): void {
    for (let r = 1; r <= 8; r++) {
      const padId = r * 10 + 9;
      this.drawMenuButton(padId);
    }
  }

  private drawMenuButton(padId: number): void {
    const app = this.apps.get(padId);
    if (app) {
      if (padId === this.activePadId) {
        setMenuRGB(padId, ACTIVE_MENU_COLOR);
      } else {
        setMenuRGB(padId, INACTIVE_MENU_COLOR);
      }
    } else {
      setMenuRGB(padId, OFF_COLOR);
    }
  }

  handleNoteOnLongPress(e: NoteMessageEvent): void {
    this.activeApp?.onNoteOnLongPress?.(e);
  }

  handleControlChangeLongPress(e: ControlChangeMessageEvent): void {
    this.activeApp?.onControlChangeLongPress?.(e);
  }

  private clearLongPressTimers(): void {
    for (const entry of this.notePressTimers.values()) {
      clearTimeout(entry.timer);
    }
    this.notePressTimers.clear();
    this.noteLongPressed.clear();

    for (const entry of this.ccPressTimers.values()) {
      clearTimeout(entry.timer);
    }
    this.ccPressTimers.clear();
    this.ccLongPressed.clear();
  }

  private handleNoteOn(e: NoteMessageEvent): void {
    const app = this.activeApp;
    if (!app || e.note.rawAttack <= 0) return;

    if (app.onNoteOnLongPress) {
      this.startNotePressTimer(e);
    } else {
      app.onNoteOn?.(e);
    }
  }

  private startNotePressTimer(e: NoteMessageEvent): void {
    const padId = e.note.number;

    const existing = this.notePressTimers.get(padId);
    if (existing) {
      clearTimeout(existing.timer);
    }
    this.noteLongPressed.delete(padId);

    const timer = setTimeout(() => {
      this.notePressTimers.delete(padId);
      this.noteLongPressed.add(padId);
      this.handleNoteOnLongPress(e);
    }, LONG_PRESS_MS);

    this.notePressTimers.set(padId, { timer, event: e });
  }

  private handleNoteOff(e: NoteMessageEvent): void {
    const app = this.activeApp;
    if (!app) return;

    if (app.onNoteOnLongPress) {
      this.resolveNotePress(e.note.number, app);
    }
    app.onNoteOff?.(e);
  }

  private resolveNotePress(padId: number, app: App): void {
    const entry = this.notePressTimers.get(padId);
    if (entry) {
      clearTimeout(entry.timer);
      this.notePressTimers.delete(padId);
      app.onNoteOn?.(entry.event);
    } else if (this.noteLongPressed.has(padId)) {
      this.noteLongPressed.delete(padId);
    }
  }

  private isMenuButton(padId: number): boolean {
    return padId % 10 === 9 && padId >= 19 && padId <= 89 && this.apps.has(padId);
  }

  private handleControlChange(e: ControlChangeMessageEvent): void {
    const padId = e.controller.number;
    const velocity = e.message.data[2] ?? 0;

    if (this.isMenuButton(padId)) {
      this.handleMenuButton(padId, velocity);
      return;
    }

    this.forwardControlChange(e, velocity);
  }

  private handleMenuButton(padId: number, velocity: number): void {
    if (velocity > 0) {
      this.startMenuHold(padId);
    } else {
      this.cancelMenuHold(padId);
    }
  }

  private startMenuHold(padId: number): void {
    const existing = this.holdTimers.get(padId);
    if (existing) {
      clearTimeout(existing);
    }

    setMenuRGBFlashing(padId, { rgb: [127, 0, 0], duration: MENU_HOLD_FLASH_DURATION });

    const timer = setTimeout(() => {
      this.holdTimers.delete(padId);
      this.switchApp(padId);
    }, MENU_HOLD_MS);

    this.holdTimers.set(padId, timer);
  }

  private cancelMenuHold(padId: number): void {
    const timer = this.holdTimers.get(padId);
    if (timer === undefined) return;

    clearTimeout(timer);
    this.holdTimers.delete(padId);
    this.drawMenuButton(padId);
  }

  private forwardControlChange(e: ControlChangeMessageEvent, velocity: number): void {
    const app = this.activeApp;
    if (!app) return;

    if (!app.onControlChangeLongPress) {
      app.onControlChange?.(e);
      return;
    }

    if (velocity > 0) {
      this.startCcPressTimer(e);
    } else {
      this.resolveCcPress(e.controller.number, app);
    }
  }

  private startCcPressTimer(e: ControlChangeMessageEvent): void {
    const padId = e.controller.number;

    const existing = this.ccPressTimers.get(padId);
    if (existing) {
      clearTimeout(existing.timer);
    }
    this.ccLongPressed.delete(padId);

    const timer = setTimeout(() => {
      this.ccPressTimers.delete(padId);
      this.ccLongPressed.add(padId);
      this.handleControlChangeLongPress(e);
    }, LONG_PRESS_MS);

    this.ccPressTimers.set(padId, { timer, event: e });
  }

  private resolveCcPress(padId: number, app: App): void {
    const entry = this.ccPressTimers.get(padId);
    if (entry) {
      clearTimeout(entry.timer);
      this.ccPressTimers.delete(padId);
      app.onControlChange?.(entry.event);
    } else if (this.ccLongPressed.has(padId)) {
      this.ccLongPressed.delete(padId);
    }
  }

  getActiveApp(): App | null {
    return this.activeApp;
  }

  getActivePadId(): number | null {
    return this.activePadId;
  }
}

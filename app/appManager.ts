import { lpInput } from "./midi";
import {
  enterProgrammerMode,
  clearGrid,
  setMenuRGB,
  setMenuRGBFlashing,
} from "./grid";
import type { App } from "./types";
import type { NoteMessageEvent, ControlChangeMessageEvent } from "webmidi";

export class AppManager {
  private apps: Map<number, App> = new Map();
  private activeApp: App | null = null;
  private activePadId: number | null = null;
  private holdTimers: Map<number, any> = new Map();
  private notePressTimers: Map<number, { timer: any; event: NoteMessageEvent }> = new Map();
  private noteLongPressed: Set<number> = new Set();
  private ccPressTimers: Map<number, { timer: any; event: ControlChangeMessageEvent }> = new Map();
  private ccLongPressed: Set<number> = new Set();

  registerApp(padId: number, app: App): void {
    this.apps.set(padId, app);
  }

  init(): void {
    if (!lpInput) return;

    enterProgrammerMode();
    lpInput.removeListener();

    // Register global event listeners
    lpInput.addListener("noteon", (e) => this.handleNoteOn(e));
    lpInput.addListener("noteoff", (e) => this.handleNoteOff(e));
    lpInput.addListener("controlchange", (e) => this.handleControlChange(e));

    // Launch default app (first registered)
    const firstPad = Array.from(this.apps.keys())[0];
    if (firstPad) {
      this.switchApp(firstPad);
    }
  }

  switchApp(padId: number): void {
    const nextApp = this.apps.get(padId);
    if (!nextApp) return;

    console.log(`[AppManager] Switching to app: ${nextApp.name}`);

    // Clear long press timers
    this.clearLongPressTimers();

    // 1. Clean up old app
    if (this.activeApp?.cleanup) {
      this.activeApp.cleanup();
    }

    // 2. Setup new active state
    this.activeApp = nextApp;
    this.activePadId = padId;

    // 3. Reset grid & draw current app
    clearGrid();
    this.drawMenuButtons();
    this.activeApp.init();
  }

  private drawMenuButtons(): void {
    // Redraw menu buttons (19-89)
    for (let r = 1; r <= 8; r++) {
      const padId = r * 10 + 9;
      this.drawMenuButton(padId);
    }
  }

  private drawMenuButton(padId: number): void {
    const app = this.apps.get(padId);
    if (app) {
      if (padId === this.activePadId) {
        setMenuRGB(padId, 0, 127, 0); // Bright green for active
      } else {
        setMenuRGB(padId, 20, 20, 20); // Dim gray for inactive/available
      }
    } else {
      setMenuRGB(padId, 0, 0, 0); // Off
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
    const padId = e.note.number;
    const velocity = e.note.rawAttack;

    if (velocity > 0) {
      if (this.activeApp?.onNoteOnLongPress) {
        if (this.notePressTimers.has(padId)) {
          clearTimeout(this.notePressTimers.get(padId)!.timer);
        }
        this.noteLongPressed.delete(padId);

        const timer = setTimeout(() => {
          this.notePressTimers.delete(padId);
          this.noteLongPressed.add(padId);
          this.handleNoteOnLongPress(e);
        }, 400); // 400ms threshold

        this.notePressTimers.set(padId, { timer, event: e });
      } else {
        this.activeApp?.onNoteOn?.(e);
      }
    }
  }

  private handleNoteOff(e: NoteMessageEvent): void {
    const padId = e.note.number;

    if (this.activeApp?.onNoteOnLongPress) {
      const entry = this.notePressTimers.get(padId);
      if (entry) {
        clearTimeout(entry.timer);
        this.notePressTimers.delete(padId);
        this.activeApp?.onNoteOn?.(entry.event); // Trigger short press (represented as onNoteOn) with original NoteOn event
      } else if (this.noteLongPressed.has(padId)) {
        this.noteLongPressed.delete(padId);
      }
      this.activeApp?.onNoteOff?.(e);
    } else {
      this.activeApp?.onNoteOff?.(e);
    }
  }

  private handleControlChange(e: ControlChangeMessageEvent): void {
    const padId = e.controller.number;
    const velocity = e.message.data[2] || 0;

    const isMenuButton =
      padId % 10 === 9 && padId >= 19 && padId <= 89 && this.apps.has(padId);

    if (isMenuButton) {
      if (velocity > 0) {
        // Start 2-second hold timer
        if (this.holdTimers.has(padId)) {
          clearTimeout(this.holdTimers.get(padId));
        }

        // Visual feedback: Flash the button red rapidly while holding
        setMenuRGBFlashing(padId, 127, 0, 0, 300);

        const timer = setTimeout(() => {
          this.holdTimers.delete(padId);
          this.switchApp(padId);
        }, 1500);

        this.holdTimers.set(padId, timer);
      } else {
        // Button released before 2 seconds: cancel switch
        if (this.holdTimers.has(padId)) {
          clearTimeout(this.holdTimers.get(padId));
          this.holdTimers.delete(padId);
          // Restore standard menu button color
          this.drawMenuButton(padId);
        }
      }
      return;
    }

    // Forward other CC events
    if (this.activeApp?.onControlChangeLongPress) {
      if (velocity > 0) {
        if (this.ccPressTimers.has(padId)) {
          clearTimeout(this.ccPressTimers.get(padId)!.timer);
        }
        this.ccLongPressed.delete(padId);

        const timer = setTimeout(() => {
          this.ccPressTimers.delete(padId);
          this.ccLongPressed.add(padId);
          this.handleControlChangeLongPress(e);
        }, 400); // 400ms threshold

        this.ccPressTimers.set(padId, { timer, event: e });
      } else {
        const entry = this.ccPressTimers.get(padId);
        if (entry) {
          clearTimeout(entry.timer);
          this.ccPressTimers.delete(padId);
          this.activeApp?.onControlChange?.(entry.event); // Trigger short press using original CC event
        } else if (this.ccLongPressed.has(padId)) {
          this.ccLongPressed.delete(padId);
        }
      }
    } else {
      this.activeApp?.onControlChange?.(e);
    }
  }

  // Helper getters for testing
  getActiveApp(): App | null {
    return this.activeApp;
  }

  getActivePadId(): number | null {
    return this.activePadId;
  }
}

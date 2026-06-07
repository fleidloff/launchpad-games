import { lpInput } from "./midi";
import { enterProgrammerMode, clearGrid, setMenuRGB, setMenuRGBFlashing } from "./grid";
import type { App } from "./types";
import type { NoteMessageEvent, ControlChangeMessageEvent } from "webmidi";

export class AppManager {
  private apps: Map<number, App> = new Map();
  private activeApp: App | null = null;
  private activePadId: number | null = null;
  private holdTimers: Map<number, any> = new Map();

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
    if (!nextApp || nextApp === this.activeApp) return;

    console.log(`[AppManager] Switching to app: ${nextApp.name}`);

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

  private handleNoteOn(e: NoteMessageEvent): void {
    this.activeApp?.onNoteOn?.(e);
  }

  private handleNoteOff(e: NoteMessageEvent): void {
    this.activeApp?.onNoteOff?.(e);
  }

  private handleControlChange(e: ControlChangeMessageEvent): void {
    const padId = e.controller.number;
    const velocity = e.message.data[2] || 0;

    const isMenuButton = padId % 10 === 9 && padId >= 19 && padId <= 89 && this.apps.has(padId);

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
        }, 2000);

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
    this.activeApp?.onControlChange?.(e);
  }

  // Helper getters for testing
  getActiveApp(): App | null {
    return this.activeApp;
  }

  getActivePadId(): number | null {
    return this.activePadId;
  }
}

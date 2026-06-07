# Launchpad Games Project Context

This project is a web-based retro-style game/application engine designed specifically to run on a **Novation Launchpad X** physical grid controller (or compatible emulator). It runs locally in the browser via Vite, communicating with the device using the browser's Web MIDI API.

---

## 🏗️ Project Structure

The project has the following directory layout:

*   [index.html](file:///home/fred/dev/launchpad-games/index.html) - The main HTML entry point which renders status info in the browser.
*   [app/](file:///home/fred/dev/launchpad-games/app) - The root directory for the TypeScript codebase.
    *   [app.ts](file:///home/fred/dev/launchpad-games/app/app.ts) - The main entry point. Imports and initializes the active app/game.
    *   [midi.ts](file:///home/fred/dev/launchpad-games/app/midi.ts) - Manages MIDI connection detection via `webmidi`. Sets up the [lpInput](file:///home/fred/dev/launchpad-games/app/midi.ts#L4) and [lpOutput](file:///home/fred/dev/launchpad-games/app/midi.ts#L5) instances.
    *   [grid.ts](file:///home/fred/dev/launchpad-games/app/grid.ts) - High-level utilities for controlling the LED grid and SysEx.
    *   [types.ts](file:///home/fred/dev/launchpad-games/app/types.ts) - Common types like [RGB](file:///home/fred/dev/launchpad-games/app/types.ts#L1), [FlashingState](file:///home/fred/dev/launchpad-games/app/types.ts#L2-L8), and [Color](file:///home/fred/dev/launchpad-games/app/types.ts#L10).
    *   [constants.ts](file:///home/fred/dev/launchpad-games/app/constants.ts) - Novation SysEx command IDs and protocol constants.
    *   [grid.test.ts](file:///home/fred/dev/launchpad-games/app/grid.test.ts) - Tests for grid/LED state management and animations.
    *   [apps/](file:///home/fred/dev/launchpad-games/app/apps) - Contains all individual modular applications/games.
        *   [BasicButtons/](file:///home/fred/dev/launchpad-games/app/apps/BasicButtons) - A simple interactive button tester app.
        *   [FourInARow/](file:///home/fred/dev/launchpad-games/app/apps/FourInARow) - A 2-player Connect Four implementation on the grid.

---

## 🎛️ Novation Launchpad X Hardware & MIDI Layout

The project communicates with the Launchpad X in **Programmer Mode**.

### 1. Activating Programmer Mode
Before interacting with the grid, the application sends a SysEx command using [enterProgrammerMode()](file:///home/fred/dev/launchpad-games/app/grid.ts#L19-L23):
```typescript
lpOutput.sendSysex(NOVATION_ID, [LAUNCHPAD_X_ID, CMD_API_SUB_ID, 0x0e, 0x03]);
```

### 2. Pad Grid Layout & Pad IDs
In Programmer Mode, each pad is mapped to a numeric ID where:
*   The **tens digit** represents the row (1 to 9, bottom to top).
*   The **units digit** represents the column (1 to 9, left to right).

```
   ┌───┬───┬───┬───┬───┬───┬───┬───┐ ┌───┐
Row│91 │92 │93 │94 │95 │96 │97 │98 │ │99 │ (Top Control Buttons)
   ├───┼───┼───┼───┼───┼───┼───┼───┤ ├───┤
8  │81 │82 │83 │84 │85 │86 │87 │88 │ │89 │
7  │71 │72 │73 │74 │75 │76 │77 │78 │ │79 │
6  │61 │62 │63 │64 │65 │66 │67 │68 │ │69 │
5  │51 │52 │53 │54 │55 │56 │57 │58 │ │59 │ (8x8 LED Play Grid)
4  │41 │42 │43 │44 │45 │46 │47 │48 │ │49 │
3  │31 │32 │33 │34 │35 │36 │37 │38 │ │39 │
2  │21 │22 │23 │24 │25 │26 │27 │28 │ │29 │
1  │11 │12 │13 │14 │15 │16 │17 │18 │ │19 │
   └───┴───┴───┴───┴───┴───┴───┴───┘ └───┘
Col  1   2   3   4   5   6   7   8    9  (Right Control Buttons)
```

### 3. MIDI Messages (Note On vs Control Change)
Inputs from the Launchpad X are received as different event types:
*   **Grid Pads (11–88):** Emit standard MIDI **Note On** / **Note Off** events (using `lpInput.addListener("noteon", ...)`).
*   **Top Row (91–99) & Right Column (19–89):** Emit **Control Change (CC)** events (using `lpInput.addListener("controlchange", ...)`).

---

## 🎨 Lighting & Colors

The Launchpad X LEDs are controlled using RGB SysEx messages.
*   **Color Scale:** Each red, green, and blue intensity must be in the range **`0` to `127`** (MIDI standard, not `0-255`).
*   **Grid Helpers:**
    *   [setRGB(padId, r, g, b)](file:///home/fred/dev/launchpad-games/app/grid.ts#L52-L61) - Lights a pad with static RGB colors.
    *   [setRGBFlashing(padId, r, g, b, duration)](file:///home/fred/dev/launchpad-games/app/grid.ts#L63-L78) - Animates a pad's color flashing between the target RGB and off, using `requestAnimationFrame`.
    *   [clearGrid()](file:///home/fred/dev/launchpad-games/app/grid.ts#L124-L128) - Clears all LEDs (sets them to `0, 0, 0`).

---

## 🛠️ Build, Development, and Testing Commands

Run the following scripts from the project root:

*   **Start development server:** `npm run dev`
*   **Run Vitest unit tests:** `npm run test`
*   **Build production package:** `npm run build`

---

## 🤖 Guide for Agent Developers

When developing new apps or editing existing ones, follow these guidelines:

### 1. Structure of an App
Every app is self-contained under [app/apps/](file:///home/fred/dev/launchpad-games/app/apps) and exports an `init()` function:
```typescript
import { lpInput } from "../../midi";
import { enterProgrammerMode, clearGrid } from "../../grid";

export function init(): void {
  if (!lpInput) return;
  
  // 1. Enter programmer mode
  enterProgrammerMode();
  
  // 2. Clear state from previous app
  clearGrid();
  
  // 3. CRITICAL: Remove any registered listeners first to prevent leaking callbacks!
  lpInput.removeListener();
  
  // 4. Register new MIDI event handlers
  lpInput.addListener("noteon", (e) => { ... });
  lpInput.addListener("controlchange", (e) => { ... });
}
```

### 2. Activating Your App
To run your app, register/import it in [app/app.ts](file:///home/fred/dev/launchpad-games/app/app.ts) and call its `init()` within `startApp()`:
```typescript
import * as myNewApp from "./apps/MyNewApp/myNewApp";

async function startApp() {
  await initMidi(() => {
    myNewApp.init(); // Run your app here
  });
}
```

### 3. Writing Tests
Create tests in the same directory as the app (e.g., `myNewApp.test.ts`). Mock the [grid](file:///home/fred/dev/launchpad-games/app/grid.ts) and [midi](file:///home/fred/dev/launchpad-games/app/midi.ts) modules to verify the logic. Refer to [fourInARow.test.ts](file:///home/fred/dev/launchpad-games/app/apps/FourInARow/fourInARow.test.ts) or [basicButtons.test.ts](file:///home/fred/dev/launchpad-games/app/apps/BasicButtons/basicButtons.test.ts) for boilerplate and examples.

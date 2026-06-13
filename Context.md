# Launchpad Games Project Context

This project is a web-based retro-style game/application engine designed specifically to run on a **Novation Launchpad X** physical grid controller (or compatible emulator). It runs locally in the browser via Vite, communicating with the device using the browser's Web MIDI API.

---

## 🏗️ Project Structure

The project has the following directory layout:

*   [index.html](file:///home/fred/dev/launchpad-games/index.html) - The main HTML entry point which renders status info in the browser.
*   [app/](file:///home/fred/dev/launchpad-games/app) - The root directory for the TypeScript codebase.
    *   [app.ts](file:///home/fred/dev/launchpad-games/app/app.ts) - The main entry point. Registers apps and boots the [AppManager](file:///home/fred/dev/launchpad-games/app/core/appManager.ts).
    *   [core/](file:///home/fred/dev/launchpad-games/app/core) - Core launchpad system controllers and interfaces.
        *   [appManager.ts](file:///home/fred/dev/launchpad-games/app/core/appManager.ts) - The central controller that registers apps, intercepts menu buttons, and delegates inputs.
        *   [midi.ts](file:///home/fred/dev/launchpad-games/app/core/midi.ts) - Manages MIDI connection detection via `webmidi`. Sets up the [lpInput](file:///home/fred/dev/launchpad-games/app/core/midi.ts#L4) and [lpOutput](file:///home/fred/dev/launchpad-games/app/core/midi.ts#L5) instances.
        *   [grid.ts](file:///home/fred/dev/launchpad-games/app/core/grid.ts) - High-level utilities for controlling the LED grid and SysEx.
        *   [constants.ts](file:///home/fred/dev/launchpad-games/app/core/constants.ts) - Novation SysEx command IDs and protocol constants.
        *   [grid.test.ts](file:///home/fred/dev/launchpad-games/app/core/grid.test.ts) - Tests for grid/LED state management and animations.
    *   [types.ts](file:///home/fred/dev/launchpad-games/app/types.ts) - Common types like [RGB](file:///home/fred/dev/launchpad-games/app/types.ts#L1), [FlashingState](file:///home/fred/dev/launchpad-games/app/types.ts#L2-L8), and [Color](file:///home/fred/dev/launchpad-games/app/types.ts#L10).
    *   [apps/](file:///home/fred/dev/launchpad-games/app/apps) - Contains all individual modular applications/games.
        *   [BasicButtons/](file:///home/fred/dev/launchpad-games/app/apps/BasicButtons) - A simple interactive button tester app.
        *   [FourInARow/](file:///home/fred/dev/launchpad-games/app/apps/FourInARow) - A 2-player Connect Four implementation on the grid.
        *   [TactileSnake/](file:///home/fred/dev/launchpad-games/app/apps/TactileSnake) - Classic Snake game utilizing relative matrix controls.
        *   [Meowdoku/](file:///home/fred/dev/launchpad-games/app/apps/Meowdoku) - A "find the cats" logic puzzle (Queens/Star-Battle style) on the full 8x8 grid split into 8 colored regions; place one cat per row, per column and per region, with no two cats touching (including diagonally). 3 hearts; rule-breaking placements cost a life.
        *   [Chess/](file:///home/fred/dev/launchpad-games/app/apps/Chess) - Play chess against an AI on the 8x8 grid (squares A1-H8 map to pads 11-88). Built on the [js-chess-engine](https://github.com/josefjadrny/js-chess-engine) library for legal-move generation and the AI opponent. See the dedicated control scheme below.

---

## ♟️ Chess App Controls

The Chess app turns the 8x8 grid into a chess board: square **A1** is the bottom-left pad **11**, **H8** is the top-right pad **88** (`padId = rank * 10 + file`). Empty squares are lit in a normal checkerboard pattern (dim light/dark); white pieces are bright white, black pieces are blue.

*   **New game:** **long-press button 98**. This resets to the side-pick screen at any time.
*   **Pick your side:** when a game starts, the first action is to pick a side by pressing any **white token** (to play White) or any **black token** (to play Black) on the board.
*   **Difficulty:** set with buttons **91-95** (level 1-5, brighter = selected) on the side-pick screen, before picking a side.
*   **Turn indicator:** once playing, the top row lights up in the color of the side to move ("show turns"). Button 97 is reserved as the show-moves toggle (see below), so the indicator spans **91-96 and 98**.
*   **Making a move (both sides):** first press the **from** square (the piece to move), then the **to** square; the turn ends on the second press.
    *   On an **AI turn**, the engine's chosen move is precomputed and the **from** field (the token to move) is lit so you can play the AI's move on the physical board; after you press it, the **to** field lights up.
    *   **Changing your mind:** while your own piece is selected, press the **same field again** to release it (you can then pick a different token), or press any other own piece to reselect directly.
*   **Show possible moves toggle:** button **97** toggles whether the legal destination squares are highlighted when you select a piece. The 97 LED is bright when highlighting is on, dim when off.
*   **Illegal moves** are flashed **yellow** and ignored.
*   **Check:** when check is announced, the checked **king** and the **checking piece(s)** are marked **solid red**.
*   **Checkmate:** the mated **king** and the **mating piece(s)** **flash red** (distinct from a regular check), and the top row flashes red. Stalemate/draw flashes the top row in a neutral color. Any grid press starts a new game.

> **Note on the right-column buttons (19-89):** these pads are reserved by the [AppManager](file:///home/fred/dev/launchpad-games/app/core/appManager.ts) as the app switcher and are protected in [grid.ts](file:///home/fred/dev/launchpad-games/app/core/grid.ts) — apps cannot light them. Turn indication therefore uses the top row (91-98) only.

> ⚠️ **Button 99 (top-right corner):** this pad may be **lit** for decoration but must **never be used as an input — never read or act on a press of 99**. The Chess app lights it dimly and ignores it entirely.

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
Every app is self-contained under [app/apps/](file:///home/fred/dev/launchpad-games/app/apps) and exports an object implementing the `App` interface (defined in [types.ts](file:///home/fred/dev/launchpad-games/app/types.ts)):

```typescript
import type { App } from "../../types";
import type { NoteMessageEvent, ControlChangeMessageEvent } from "webmidi";

export const myNewApp: App = {
  name: "My New App",

  init(): void {
    // 1. Draw initial visual elements on the grid (e.g. setRGB)
  },

  cleanup?(): void {
    // 2. Clear any local game timers, intervals, or animation flags
  },

  onNoteOn?(e: NoteMessageEvent): void {
    // 3. Handle grid pad presses (velocity > 0).
    //    Note: if onNoteOnLongPress is implemented, this is deferred and called on release
    //    only if the button was not held long enough to trigger a long press.
  },

  onNoteOff?(e: NoteMessageEvent): void {
    // 4. Handle grid pad releases (velocity == 0)
  },

  onControlChange?(e: ControlChangeMessageEvent): void {
    // 5. Handle top row button events (Note: right column events are intercepted).
    //    Note: if onControlChangeLongPress is implemented, this is deferred and called on release
    //    only if the button was not held long enough to trigger a long press.
  },

  onNoteOnLongPress?(e: NoteMessageEvent): void {
    // 6. Optional: Handle long press on grid pads (held >= 400ms)
  },

  onControlChangeLongPress?(e: ControlChangeMessageEvent): void {
    // 7. Optional: Handle long press on CC/control buttons (held >= 400ms)
  }
};
```

### 2. Registering and Activating Your App
To run your app, register it with the `AppManager` instance in [app/app.ts](file:///home/fred/dev/launchpad-games/app/app.ts) on an available right column button (e.g. `69`):

```typescript
import { myNewApp } from "./apps/MyNewApp/myNewApp";

// Register app to button 69
manager.registerApp(69, myNewApp);
```

### 3. Hold-to-Switch Mechanism
Apps are switched using the right column control buttons (`19`–`89`). 
*   To switch, the button must be held for **`2.0 seconds`** (to prevent accidental switches).
*   During the hold, the button will flash red rapidly (`300ms` cycle). If released early, the switch is canceled, and the button reverts to its original color state.
*   **Menu Protection**: The right column menu buttons (`19`–`89`) are protected in [grid.ts](file:///home/fred/dev/launchpad-games/app/grid.ts). Standard app calls to `setRGB()`, `setRGBFlashing()`, and `clearGrid()` are restricted from modifying these pads, preventing apps from overwriting switcher menu state during gameplay. The manager uses dedicated `setMenuRGB()` and `setMenuRGBFlashing()` to update these LEDs.
*   Upon switching, `cleanup()` is called on the active app, the grid is cleared, the menu LEDs update, and `init()` is called on the new app.

### 4. Writing Tests
Create tests in the same directory as the app (e.g., `myNewApp.test.ts`). You can test the app logic by calling methods directly on your exported app object or invoking its lifecycle event handlers. Refer to [fourInARow.test.ts](file:///home/fred/dev/launchpad-games/app/apps/FourInARow/fourInARow.test.ts) or [basicButtons.test.ts](file:///home/fred/dev/launchpad-games/app/apps/BasicButtons/basicButtons.test.ts) for examples.


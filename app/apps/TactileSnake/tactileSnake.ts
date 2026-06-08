import { clearGrid, setRGB, setRGBFlashing } from "../../core/grid";
import type { App } from "../../types";
import type { NoteMessageEvent } from "webmidi";

type Coord = [number, number];
type Direction = "up" | "down" | "left" | "right";

const ROWS = 8;
const COLS = 8;
const GAME_TICK_MS = 400;

export let snake: Coord[] = [];
export let direction: Direction = "right";
export let nextDirection: Direction = "right";
export let apple: Coord = [0, 0];
export let isGameOver = false;
let gameInterval: any = null;
let isCurrentAppActive = false;

export function resetGame(): void {
  console.log("[TactileSnake] Resetting game...");
  if (gameInterval) {
    clearInterval(gameInterval);
    gameInterval = null;
  }

  isGameOver = false;
  direction = "right";
  nextDirection = "right";

  // Initial snake: head at (4, 3), body trailing to the left
  snake = [
    [4, 3],
    [4, 2],
    [4, 1],
  ];

  clearGrid();
  spawnApple();
  drawState();

  gameInterval = setInterval(gameTick, GAME_TICK_MS);
}

function spawnApple(): void {
  // Find a free spot on the board
  const freeSpots: Coord[] = [];
  for (let r = 1; r <= ROWS; r++) {
    for (let c = 1; c <= COLS; c++) {
      const isOnSnake = snake.some(([sr, sc]) => sr === r && sc === c);
      if (!isOnSnake) {
        freeSpots.push([r, c]);
      }
    }
  }

  const randomSpot = freeSpots[Math.floor(Math.random() * freeSpots.length)];
  if (randomSpot) {
    apple = randomSpot;
  } else {
    // Grid completely full: Win condition? Restart
    apple = [1, 1];
  }
}

function gameTick(): void {
  if (!isCurrentAppActive || isGameOver) return;

  direction = nextDirection;
  const [hr, hc] = snake[0] || [4, 3];

  let nextHr = hr;
  let nextHc = hc;

  if (direction === "up") nextHr += 1;
  else if (direction === "down") nextHr -= 1;
  else if (direction === "left") nextHc -= 1;
  else if (direction === "right") nextHc += 1;

  // Check collision with walls
  if (nextHr < 1 || nextHr > ROWS || nextHc < 1 || nextHc > COLS) {
    handleGameOver();
    return;
  }

  // Check collision with self
  const hitsSelf = snake.some(([sr, sc]) => sr === nextHr && sc === nextHc);
  if (hitsSelf) {
    handleGameOver();
    return;
  }

  // Move snake
  snake.unshift([nextHr, nextHc]);

  // Check if eating apple
  if (nextHr === apple[0] && nextHc === apple[1]) {
    spawnApple();
  } else {
    // Remove tail
    const tail = snake.pop();
    if (tail) {
      const [tr, tc] = tail;
      setRGB(tr * 10 + tc, 0, 0, 0); // Clear tail LED
    }
  }

  drawState();
}

function drawState(): void {
  // Draw apple (blinking red)
  setRGBFlashing(apple[0] * 10 + apple[1], 127, 0, 0, 500);

  // Draw snake body (normal green)
  for (let i = 1; i < snake.length; i++) {
    const coord = snake[i];
    if (coord) {
      setRGB(coord[0] * 10 + coord[1], 0, 80, 0);
    }
  }

  // Draw snake head (brighter green-blue to identify front)
  const head = snake[0];
  if (head) {
    setRGB(head[0] * 10 + head[1], 0, 127, 30);
  }
}

function handleGameOver(): void {
  console.log("[TactileSnake] Game Over!");
  isGameOver = true;
  if (gameInterval) {
    clearInterval(gameInterval);
    gameInterval = null;
  }

  // Flash the entire play grid red
  for (let r = 1; r <= ROWS; r++) {
    for (let c = 1; c <= COLS; c++) {
      setRGBFlashing(r * 10 + c, 127, 0, 0, 500);
    }
  }
}

export function handleInput(padId: number): void {
  if (isGameOver) {
    resetGame();
    return;
  }

  const tr = Math.floor(padId / 10);
  const tc = padId % 10;

  // Check if tap is on valid 8x8 grid
  if (tr < 1 || tr > ROWS || tc < 1 || tc > COLS) return;

  const head = snake[0];
  if (!head) return;

  const [hr, hc] = head;
  const dr = tr - hr;
  const dc = tc - hc;

  // Ignore tap directly on the head
  if (dr === 0 && dc === 0) return;

  if (Math.abs(dc) > Math.abs(dr)) {
    // Horizontal alignment predominant
    if (dc > 0) {
      // Tap is to the right
      if (direction !== "left") {
        nextDirection = "right";
      }
    } else {
      // Tap is to the left
      if (direction !== "right") {
        nextDirection = "left";
      }
    }
  } else {
    // Vertical alignment predominant
    if (dr > 0) {
      // Tap is above
      if (direction !== "down") {
        nextDirection = "up";
      }
    } else {
      // Tap is below
      if (direction !== "up") {
        nextDirection = "down";
      }
    }
  }
}

export const tactileSnakeApp: App = {
  name: "Tactile Snake",

  init(): void {
    isCurrentAppActive = true;
    resetGame();
  },

  cleanup(): void {
    isCurrentAppActive = false;
    if (gameInterval) {
      clearInterval(gameInterval);
      gameInterval = null;
    }
  },

  onNoteOn(e: NoteMessageEvent): void {
    const padId = e.note.number;
    const velocity = e.note.rawAttack;

    if (velocity > 0) {
      handleInput(padId);
    }
  }
};

import { clearGrid, setRGB, setRGBFlashing } from "../../core/grid";
import type { App } from "../../types";
import type { NoteMessageEvent } from "webmidi";

type Coord = [number, number];
type Direction = "up" | "down" | "left" | "right";

const ROWS = 8;
const COLS = 8;
const GAME_TICK_MS = 400;
const INITIAL_HEAD: Coord = [4, 3];

const DIRECTION_VECTORS: Record<Direction, Coord> = {
  up: [1, 0],
  down: [-1, 0],
  left: [0, -1],
  right: [0, 1],
};

const OPPOSITE_DIRECTIONS: Record<Direction, Direction> = {
  up: "down",
  down: "up",
  left: "right",
  right: "left",
};

export let snake: Coord[] = [];
export let direction: Direction = "right";
export let nextDirection: Direction = "right";
export let apple: Coord = [0, 0];
export let isGameOver = false;
let gameInterval: ReturnType<typeof setInterval> | null = null;
let isCurrentAppActive = false;

function stopGameLoop(): void {
  if (gameInterval !== null) {
    clearInterval(gameInterval);
    gameInterval = null;
  }
}

export function resetGame(): void {
  stopGameLoop();

  isGameOver = false;
  direction = "right";
  nextDirection = "right";

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
  apple = randomSpot ?? [1, 1];
}

function computeNextHead(): Coord {
  const [headRow, headCol] = snake[0] ?? INITIAL_HEAD;
  const [rowDelta, colDelta] = DIRECTION_VECTORS[direction];
  return [headRow + rowDelta, headCol + colDelta];
}

function isOnPlayGrid(row: number, col: number): boolean {
  return row >= 1 && row <= ROWS && col >= 1 && col <= COLS;
}

function hitsWallOrSelf([row, col]: Coord): boolean {
  if (!isOnPlayGrid(row, col)) {
    return true;
  }
  return snake.some(([sr, sc]) => sr === row && sc === col);
}

function advanceTail([headRow, headCol]: Coord): void {
  if (headRow === apple[0] && headCol === apple[1]) {
    spawnApple();
    return;
  }
  const tail = snake.pop();
  if (tail) {
    setRGB(tail[0] * 10 + tail[1]);
  }
}

function gameTick(): void {
  if (!isCurrentAppActive || isGameOver) return;

  direction = nextDirection;
  const nextHead = computeNextHead();

  if (hitsWallOrSelf(nextHead)) {
    handleGameOver();
    return;
  }

  snake.unshift(nextHead);
  advanceTail(nextHead);
  drawState();
}

function drawState(): void {
  setRGBFlashing(apple[0] * 10 + apple[1], { rgb: [127, 0, 0], duration: 500 });

  for (let i = 1; i < snake.length; i++) {
    const coord = snake[i];
    if (coord) {
      setRGB(coord[0] * 10 + coord[1], [0, 80, 0]);
    }
  }

  const head = snake[0];
  if (head) {
    setRGB(head[0] * 10 + head[1], [0, 127, 30]);
  }
}

function handleGameOver(): void {
  isGameOver = true;
  stopGameLoop();

  for (let r = 1; r <= ROWS; r++) {
    for (let c = 1; c <= COLS; c++) {
      setRGBFlashing(r * 10 + c, { rgb: [127, 0, 0], duration: 500 });
    }
  }
}

function directionFromOffset(rowOffset: number, colOffset: number): Direction {
  if (Math.abs(colOffset) > Math.abs(rowOffset)) {
    return colOffset > 0 ? "right" : "left";
  }
  return rowOffset > 0 ? "up" : "down";
}

function directionFromPad(padId: number): Direction | null {
  const tappedRow = Math.floor(padId / 10);
  const tappedCol = padId % 10;

  if (!isOnPlayGrid(tappedRow, tappedCol)) return null;

  const head = snake[0];
  if (!head) return null;

  const rowOffset = tappedRow - head[0];
  const colOffset = tappedCol - head[1];

  if (rowOffset === 0 && colOffset === 0) return null;

  return directionFromOffset(rowOffset, colOffset);
}

export function handleInput(padId: number): void {
  if (isGameOver) {
    resetGame();
    return;
  }

  const tappedDirection = directionFromPad(padId);
  if (tappedDirection !== null && tappedDirection !== OPPOSITE_DIRECTIONS[direction]) {
    nextDirection = tappedDirection;
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
    stopGameLoop();
  },

  onNoteOn(e: NoteMessageEvent): void {
    const padId = e.note.number;
    const velocity = e.note.rawAttack;

    if (velocity > 0) {
      handleInput(padId);
    }
  },
};

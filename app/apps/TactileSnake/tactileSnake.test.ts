import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import * as snakeApp from "./tactileSnake";
import * as grid from "../../grid";

// Mock the grid module
vi.mock("../../grid", () => ({
  getColor: vi.fn(),
  setRGB: vi.fn(),
  setRGBFlashing: vi.fn(),
  enterProgrammerMode: vi.fn(),
  clearGrid: vi.fn(),
}));

// Mock the midi module
vi.mock("../../midi", () => ({
  lpInput: {
    removeListener: vi.fn(),
    addListener: vi.fn(),
  },
}));

describe("tactileSnake.ts", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
    // Enable the app flag internally when testing
    snakeApp.tactileSnakeApp.init();
  });

  afterEach(() => {
    snakeApp.tactileSnakeApp.cleanup?.();
    vi.useRealTimers();
  });

  it("should initialize with custom snake coordinates and spawn apple", () => {
    expect(snakeApp.snake.length).toBe(3);
    // Head at (4,3), trailing left: (4,2), (4,1)
    expect(snakeApp.snake[0]).toEqual([4, 3]);
    expect(snakeApp.snake[1]).toEqual([4, 2]);
    expect(snakeApp.snake[2]).toEqual([4, 1]);
    expect(snakeApp.direction).toBe("right");
    expect(snakeApp.isGameOver).toBe(false);

    expect(grid.clearGrid).toHaveBeenCalled();
    expect(grid.setRGBFlashing).toHaveBeenCalled(); // Apple draws blinking
  });

  it("should change nextDirection to UP when tapping above the snake head", () => {
    // Snake head is at (4,3). Let's tap at (6, 3) -> row 6 is above row 4
    snakeApp.handleInput(63);
    expect(snakeApp.nextDirection).toBe("up");
  });

  it("should change nextDirection to DOWN when tapping below the snake head", () => {
    // Snake head is at (4,3). Let's tap at (2, 3) -> row 2 is below row 4
    snakeApp.handleInput(23);
    expect(snakeApp.nextDirection).toBe("down");
  });

  it("should change nextDirection to LEFT when tapping to the left of the head", () => {
    // Wait, snake starts moving right. Tapping left would be a 180 degree turn.
    // Let's first turn up, tick, and then tap left!
    snakeApp.handleInput(63); // Up
    vi.advanceTimersByTime(400); // Step up. New head is at (5,3)

    // Tap to the left: (5, 1) -> column 1 is left of column 3
    snakeApp.handleInput(51);
    expect(snakeApp.nextDirection).toBe("left");
  });

  it("should ignore 180-degree turns that cause immediate suicide", () => {
    // Snake starts moving right. Tapping left (4, 1) should be ignored
    snakeApp.handleInput(41);
    expect(snakeApp.nextDirection).toBe("right"); // remains right
  });

  it("should trigger game over on hitting the wall", () => {
    // Snake head is at (4,3) going right.
    // Let's advance timers by 6 ticks (ticks = 400ms each)
    // Head will move: (4,4), (4,5), (4,6), (4,7), (4,8), and then hit (4,9) -> Wall!
    
    expect(snakeApp.isGameOver).toBe(false);
    
    vi.advanceTimersByTime(400 * 6);
    
    expect(snakeApp.isGameOver).toBe(true);
    expect((grid.setRGBFlashing as any).mock.calls.length).toBeGreaterThanOrEqual(65); // 1 (initial apple) + 64 (entire grid flash) + any apples eaten
  });

  it("should trigger game over on hitting self", () => {
    // Let's manually extend the snake so it can loop into itself
    // Head at (4,3). Body: (4,4), (5,4), (5,3)
    snakeApp.snake.unshift([4, 4]);
    snakeApp.snake.unshift([5, 4]);
    snakeApp.snake.unshift([5, 3]);

    // Head is now at (5,3). Direction is right. If we turn down, it goes to (4,3) which is in the body!
    snakeApp.handleInput(13); // Turn down (tap row 1 col 3)
    expect(snakeApp.nextDirection).toBe("down");

    vi.advanceTimersByTime(400);

    expect(snakeApp.isGameOver).toBe(true);
  });

  it("should restart the game when input is received after game over", () => {
    // Trigger game over by hitting wall
    vi.advanceTimersByTime(400 * 6);
    expect(snakeApp.isGameOver).toBe(true);

    // Tap any pad
    snakeApp.handleInput(11);
    expect(snakeApp.isGameOver).toBe(false);
  });
});

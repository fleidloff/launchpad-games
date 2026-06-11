import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import * as snakeApp from "./tactileSnake";
import * as grid from "../../core/grid";

vi.mock("../../core/grid", () => ({
  getColor: vi.fn(),
  setRGB: vi.fn(),
  setRGBFlashing: vi.fn(),
  enterProgrammerMode: vi.fn(),
  clearGrid: vi.fn(),
}));

vi.mock("../../core/midi", () => ({
  lpInput: {
    removeListener: vi.fn(),
    addListener: vi.fn(),
  },
}));

describe("tactileSnake.ts", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
    snakeApp.tactileSnakeApp.init();
  });

  afterEach(() => {
    snakeApp.tactileSnakeApp.cleanup?.();
    vi.useRealTimers();
  });

  it("should initialize with custom snake coordinates and spawn apple", () => {
    expect(snakeApp.snake.length).toBe(3);
    expect(snakeApp.snake[0]).toEqual([4, 3]);
    expect(snakeApp.snake[1]).toEqual([4, 2]);
    expect(snakeApp.snake[2]).toEqual([4, 1]);
    expect(snakeApp.direction).toBe("right");
    expect(snakeApp.isGameOver).toBe(false);

    expect(grid.clearGrid).toHaveBeenCalled();
    expect(grid.setRGBFlashing).toHaveBeenCalled();
  });

  it("should change nextDirection to UP when tapping above the snake head", () => {
    snakeApp.handleInput(63);
    expect(snakeApp.nextDirection).toBe("up");
  });

  it("should change nextDirection to DOWN when tapping below the snake head", () => {
    snakeApp.handleInput(23);
    expect(snakeApp.nextDirection).toBe("down");
  });

  it("should change nextDirection to LEFT when tapping to the left of the head", () => {
    snakeApp.handleInput(63);
    vi.advanceTimersByTime(400);

    snakeApp.handleInput(51);
    expect(snakeApp.nextDirection).toBe("left");
  });

  it("should ignore 180-degree turns that cause immediate suicide", () => {
    snakeApp.handleInput(41);
    expect(snakeApp.nextDirection).toBe("right");
  });

  it("should trigger game over on hitting the wall", () => {
    expect(snakeApp.isGameOver).toBe(false);

    vi.advanceTimersByTime(400 * 6);

    expect(snakeApp.isGameOver).toBe(true);
    expect(vi.mocked(grid.setRGBFlashing).mock.calls.length).toBeGreaterThanOrEqual(65);
  });

  it("should trigger game over on hitting self", () => {
    snakeApp.snake.unshift([4, 4]);
    snakeApp.snake.unshift([5, 4]);
    snakeApp.snake.unshift([5, 3]);

    snakeApp.handleInput(13);
    expect(snakeApp.nextDirection).toBe("down");

    vi.advanceTimersByTime(400);

    expect(snakeApp.isGameOver).toBe(true);
  });

  it("should restart the game when input is received after game over", () => {
    vi.advanceTimersByTime(400 * 6);
    expect(snakeApp.isGameOver).toBe(true);

    snakeApp.handleInput(11);
    expect(snakeApp.isGameOver).toBe(false);
  });
});

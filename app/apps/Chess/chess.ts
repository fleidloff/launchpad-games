import { Game } from "js-chess-engine";
import type { BoardConfig, PieceSymbol } from "js-chess-engine";
import { setRGB, setRGBFlashing } from "../../core/grid";
import type { App, RGB } from "../../types";
import type { NoteMessageEvent, ControlChangeMessageEvent } from "webmidi";

type Side = "white" | "black";
type Phase = "setup" | "humanFrom" | "humanTo" | "aiFrom" | "aiTo" | "over";
type Move = { from: string; to: string };
type Sq = { file: number; rank: number };
type Attacker = { piece: string; file: number; rank: number };
type AttackBoard = { target: Sq; occupied: Set<string> };
type Step = [number, number];

type Palette = {
  whitePiece: RGB;
  blackPiece: RGB;
  lightSquare: RGB;
  darkSquare: RGB;
  selected: RGB;
  dest: RGB;
  aiGuide: RGB;
  illegal: RGB;
  check: RGB;
  turnWhite: RGB;
  turnBlack: RGB;
  draw: RGB;
  diffActive: RGB;
  diffIdle: RGB;
  toggleOn: RGB;
  toggleOff: RGB;
  logo: RGB;
  off: RGB;
};

const COLOR: Palette = {
  whitePiece: [127, 127, 110],
  blackPiece: [0, 50, 127],
  lightSquare: [40, 40, 40],
  darkSquare: [0, 0, 0],
  selected: [0, 127, 0],
  dest: [0, 45, 8],
  aiGuide: [110, 0, 120],
  illegal: [127, 110, 0],
  check: [127, 0, 0],
  turnWhite: [60, 60, 55],
  turnBlack: [0, 25, 70],
  draw: [40, 40, 40],
  diffActive: [0, 110, 110],
  diffIdle: [0, 18, 18],
  toggleOn: [80, 80, 0],
  toggleOff: [12, 12, 0],
  logo: [12, 4, 14],
  off: [0, 0, 0],
};

const DIFF_COUNT = 5;
const DEFAULT_LEVEL = 3;
const ILLEGAL_FLASH_MS = 250;
const ILLEGAL_RESTORE_MS = 650;
const GUIDE_FLASH_MS = 600;
const LOGO_PAD = 99;
const NEW_GAME_PAD = 98;
const MOVES_TOGGLE_PAD = 97;

const DIAG: Step[] = [
  [1, 1],
  [1, -1],
  [-1, 1],
  [-1, -1],
];
const ORTH: Step[] = [
  [1, 0],
  [-1, 0],
  [0, 1],
  [0, -1],
];
const ALL_DIRS: Step[] = [...DIAG, ...ORTH];

let game: Game = new Game();
let humanSide: Side = "white";
let level = DEFAULT_LEVEL;
let phase: Phase = "setup";
let selectedFrom: string | null = null;
let aiMove: Move | null = null;
let showMoves = true;
let active = false;
let illegalTimer: ReturnType<typeof setTimeout> | null = null;
let positionHistory: string[] = [];

export function squareToPad(square: string): number {
  const file = square.charCodeAt(0) - 64;
  const rank = square.charCodeAt(1) - 48;
  return rank * 10 + file;
}

export function padToSquare(pad: number): string {
  const rank = Math.floor(pad / 10);
  const file = pad % 10;
  return String.fromCharCode(64 + file) + String(rank);
}

export function isLightSquare(pad: number): boolean {
  const rank = Math.floor(pad / 10);
  const file = pad % 10;
  return (rank + file) % 2 === 1;
}

function coords(square: string): Sq {
  return { file: square.charCodeAt(0) - 65, rank: square.charCodeAt(1) - 49 };
}

function key(file: number, rank: number): string {
  return `${file},${rank}`;
}

function inBounds(value: number): boolean {
  return value >= 0 && value <= 7;
}

function isWhitePiece(piece: string): boolean {
  return piece === piece.toUpperCase();
}

function isColor(piece: string, side: Side): boolean {
  return (side === "white") === isWhitePiece(piece);
}

function other(side: Side): Side {
  return side === "white" ? "black" : "white";
}

function pawnAttack(attacker: Attacker, board: AttackBoard): boolean {
  const direction = attacker.piece === "P" ? 1 : -1;
  const df = board.target.file - attacker.file;
  const dr = board.target.rank - attacker.rank;
  return dr === direction && (df === 1 || df === -1);
}

function knightAttack(attacker: Attacker, board: AttackBoard): boolean {
  const df = Math.abs(board.target.file - attacker.file);
  const dr = Math.abs(board.target.rank - attacker.rank);
  return (df === 1 && dr === 2) || (df === 2 && dr === 1);
}

function kingAttack(attacker: Attacker, board: AttackBoard): boolean {
  const df = Math.abs(board.target.file - attacker.file);
  const dr = Math.abs(board.target.rank - attacker.rank);
  return df <= 1 && dr <= 1 && df + dr > 0;
}

function scanCell(params: {
  file: number;
  rank: number;
  board: AttackBoard;
}): "hit" | "blocked" | "empty" {
  const { file, rank, board } = params;
  if (file === board.target.file && rank === board.target.rank) return "hit";
  if (board.occupied.has(key(file, rank))) return "blocked";
  return "empty";
}

function rayHits(params: {
  attacker: Attacker;
  board: AttackBoard;
  step: Step;
}): boolean {
  const { attacker, board, step } = params;
  let file = attacker.file + step[0];
  let rank = attacker.rank + step[1];
  while (inBounds(file) && inBounds(rank)) {
    const cell = scanCell({ file, rank, board });
    if (cell !== "empty") return cell === "hit";
    file += step[0];
    rank += step[1];
  }
  return false;
}

function slideHits(params: {
  attacker: Attacker;
  board: AttackBoard;
  dirs: Step[];
}): boolean {
  const { attacker, board, dirs } = params;
  return dirs.some((step) => rayHits({ attacker, board, step }));
}

function bishopAttack(attacker: Attacker, board: AttackBoard): boolean {
  return slideHits({ attacker, board, dirs: DIAG });
}

function rookAttack(attacker: Attacker, board: AttackBoard): boolean {
  return slideHits({ attacker, board, dirs: ORTH });
}

function queenAttack(attacker: Attacker, board: AttackBoard): boolean {
  return slideHits({ attacker, board, dirs: ALL_DIRS });
}

const ATTACK_FNS: Record<
  string,
  (attacker: Attacker, board: AttackBoard) => boolean
> = {
  p: pawnAttack,
  n: knightAttack,
  b: bishopAttack,
  r: rookAttack,
  q: queenAttack,
  k: kingAttack,
};

function buildOccupied(pieces: Record<string, PieceSymbol>): Set<string> {
  const occupied = new Set<string>();
  for (const square of Object.keys(pieces)) {
    const sq = coords(square);
    occupied.add(key(sq.file, sq.rank));
  }
  return occupied;
}

function attacksKing(params: {
  square: string;
  piece: string;
  side: Side;
  board: AttackBoard;
}): boolean {
  const { square, piece, side, board } = params;
  if (!isColor(piece, side)) return false;
  const attack = ATTACK_FNS[piece.toLowerCase()];
  if (!attack) return false;
  const sq = coords(square);
  return attack({ piece, file: sq.file, rank: sq.rank }, board);
}

export function findAttackers(params: {
  pieces: Record<string, PieceSymbol>;
  kingSquare: string;
  byColor: Side;
}): string[] {
  const { pieces, kingSquare, byColor } = params;
  const board: AttackBoard = {
    target: coords(kingSquare),
    occupied: buildOccupied(pieces),
  };
  const result: string[] = [];
  for (const [square, piece] of Object.entries(pieces)) {
    if (attacksKing({ square, piece, side: byColor, board }))
      result.push(square);
  }
  return result;
}

export function findKingSquare(
  pieces: Record<string, PieceSymbol>,
  side: Side
): string | null {
  const symbol = side === "white" ? "K" : "k";
  const found = Object.entries(pieces).find(([, piece]) => piece === symbol);
  return found ? found[0] : null;
}

function currentState(): BoardConfig {
  return game.exportJson();
}

function legalDests(square: string): string[] {
  const map = game.moves(square);
  return map[square] ?? [];
}

function pieceColor(piece: string): RGB {
  return isWhitePiece(piece) ? COLOR.whitePiece : COLOR.blackPiece;
}

function squareColor(pad: number, pieces: Record<string, PieceSymbol>): RGB {
  const piece = pieces[padToSquare(pad)];
  if (piece) return pieceColor(piece);
  return isLightSquare(pad) ? COLOR.lightSquare : COLOR.darkSquare;
}

function drawBoard(pieces: Record<string, PieceSymbol>): void {
  for (let pad = 11; pad <= 88; pad++) {
    const unit = pad % 10;
    if (unit < 1 || unit > 8) continue;
    setRGB(pad, squareColor(pad, pieces));
  }
}

function markRed(square: string): void {
  setRGB(squareToPad(square), COLOR.check);
}

function markRedFlashing(square: string): void {
  setRGBFlashing(squareToPad(square), { rgb: COLOR.check });
}

function paintCheck(state: BoardConfig, paint: (square: string) => void): void {
  if (!state.check) return;
  const kingSquare = findKingSquare(state.pieces, state.turn);
  if (!kingSquare) return;
  paint(kingSquare);
  const attackers = findAttackers({
    pieces: state.pieces,
    kingSquare,
    byColor: other(state.turn),
  });
  for (const square of attackers) paint(square);
}

function renderCheck(state: BoardConfig): void {
  paintCheck(state, markRed);
}

function renderCheckmate(state: BoardConfig): void {
  paintCheck(state, markRedFlashing);
}

function renderTopBar(state: BoardConfig): void {
  const color = state.turn === "white" ? COLOR.turnWhite : COLOR.turnBlack;
  for (let pad = 91; pad <= 98; pad++) setRGB(pad, color);
}

function renderDifficulty(): void {
  for (let i = 0; i < DIFF_COUNT; i++) {
    setRGB(91 + i, level === i + 1 ? COLOR.diffActive : COLOR.diffIdle);
  }
  setRGB(96, COLOR.off);
  setRGB(98, COLOR.off);
}

function renderMovesToggle(): void {
  setRGB(MOVES_TOGGLE_PAD, showMoves ? COLOR.toggleOn : COLOR.toggleOff);
}

function overlaySelection(): void {
  const from = selectedFrom;
  if (!from) return;
  setRGB(squareToPad(from), COLOR.selected);
  if (!showMoves) return;
  for (const dest of legalDests(from)) setRGB(squareToPad(dest), COLOR.dest);
}

function overlayAiFrom(): void {
  const mv = aiMove;
  if (!mv) return;
  setRGBFlashing(squareToPad(mv.from), {
    rgb: COLOR.aiGuide,
    duration: GUIDE_FLASH_MS,
  });
}

function overlayAiTo(): void {
  const mv = aiMove;
  if (!mv) return;
  setRGB(squareToPad(mv.from), COLOR.selected);
  setRGBFlashing(squareToPad(mv.to), {
    rgb: COLOR.aiGuide,
    duration: GUIDE_FLASH_MS,
  });
}

const OVERLAYS: Partial<Record<Phase, () => void>> = {
  humanTo: overlaySelection,
  aiFrom: overlayAiFrom,
  aiTo: overlayAiTo,
};

function repaint(): void {
  const state = currentState();
  drawBoard(state.pieces);
  renderCheck(state);
  renderTopBar(state);
  renderMovesToggle();
  OVERLAYS[phase]?.();
}

function renderSetup(): void {
  drawBoard(currentState().pieces);
  renderDifficulty();
  renderMovesToggle();
  setRGB(LOGO_PAD, COLOR.logo);
}

function refresh(): void {
  if (phase === "setup") renderSetup();
  else if (phase !== "over") repaint();
}

function refreshIfActive(): void {
  if (active) refresh();
}

function clearIllegalTimer(): void {
  if (illegalTimer !== null) {
    clearTimeout(illegalTimer);
    illegalTimer = null;
  }
}

function flashIllegal(pad: number): void {
  setRGBFlashing(pad, { rgb: COLOR.illegal, duration: ILLEGAL_FLASH_MS });
  clearIllegalTimer();
  illegalTimer = setTimeout(refreshIfActive, ILLEGAL_RESTORE_MS);
}

function flashEndIndicator(state: BoardConfig): void {
  const color = state.checkMate ? COLOR.check : COLOR.draw;
  for (let pad = 91; pad <= 98; pad++) setRGBFlashing(pad, { rgb: color });
}

function enterGameOver(state: BoardConfig): void {
  phase = "over";
  selectedFrom = null;
  aiMove = null;
  drawBoard(state.pieces);
  if (state.checkMate) renderCheckmate(state);
  flashEndIndicator(state);
}

function computeAiMove(): Move | null {
  const randomness = 40 - 5 * level;
  const result = game.ai({ level, play: false, randomness });
  const entry = Object.entries(result.move)[0];
  return entry ? { from: entry[0], to: entry[1] } : null;
}

function startHumanTurn(): void {
  selectedFrom = null;
  phase = "humanFrom";
}

function startAiTurn(): void {
  aiMove = computeAiMove();
  phase = "aiFrom";
}

function getRepetitionKey(): string {
  return game.exportFEN().split(" ").slice(0, 4).join(" ");
}

function getGameOverConfig(state: BoardConfig, isDrawState: boolean): BoardConfig {
  return {
    ...state,
    isFinished: true,
    checkMate: state.checkMate && !isDrawState,
  };
}

function checkGameOver(): boolean {
  const state = currentState();
  const key = getRepetitionKey();
  positionHistory.push(key);
  const isRep = positionHistory.filter((k) => k === key).length >= 3;
  const isFifty = state.halfMove >= 100;
  const isDrawState = isRep || isFifty;
  if (state.isFinished || isDrawState) {
    enterGameOver(getGameOverConfig(state, isDrawState));
    return true;
  }
  return false;
}

function beginTurn(): void {
  if (checkGameOver()) return;
  if (currentState().turn === humanSide) startHumanTurn();
  else startAiTurn();
  repaint();
}

function commitMove(move: Move): void {
  game.move(move.from, move.to);
  selectedFrom = null;
  aiMove = null;
  beginTurn();
}

function handleSidePick(pad: number): void {
  const piece = currentState().pieces[padToSquare(pad)];
  if (!piece) {
    flashIllegal(pad);
    return;
  }
  humanSide = isWhitePiece(piece) ? "white" : "black";
  beginTurn();
}

function handleHumanFrom(pad: number): void {
  const square = padToSquare(pad);
  if (legalDests(square).length === 0) {
    flashIllegal(pad);
    return;
  }
  selectedFrom = square;
  phase = "humanTo";
  repaint();
}

function clearSelection(): void {
  selectedFrom = null;
  phase = "humanFrom";
  repaint();
}

function reselect(pad: number, square: string): void {
  if (legalDests(square).length === 0) {
    flashIllegal(pad);
    return;
  }
  selectedFrom = square;
  repaint();
}

function handleHumanTo(pad: number): void {
  const from = selectedFrom;
  if (!from) return;
  const square = padToSquare(pad);
  if (square === from) return clearSelection();
  if (legalDests(from).includes(square))
    return commitMove({ from, to: square });
  reselect(pad, square);
}

function handleAiFrom(pad: number): void {
  const mv = aiMove;
  if (!mv) return;
  if (padToSquare(pad) !== mv.from) return flashIllegal(pad);
  phase = "aiTo";
  repaint();
}

function handleAiTo(pad: number): void {
  const mv = aiMove;
  if (!mv) return;
  if (padToSquare(pad) !== mv.to) return flashIllegal(pad);
  commitMove(mv);
}

function handleOver(): void {
  newGame();
}

const NOTE_HANDLERS: Record<Phase, (pad: number) => void> = {
  setup: handleSidePick,
  humanFrom: handleHumanFrom,
  humanTo: handleHumanTo,
  aiFrom: handleAiFrom,
  aiTo: handleAiTo,
  over: handleOver,
};

function newGame(): void {
  clearIllegalTimer();
  game = new Game();
  selectedFrom = null;
  aiMove = null;
  positionHistory = [];
  phase = "setup";
  renderSetup();
}

function isSetupDifficulty(controller: number): boolean {
  return phase === "setup" && controller >= 91 && controller <= 95;
}

function setLevel(value: number): void {
  level = value;
  renderDifficulty();
}

function toggleShowMoves(): void {
  showMoves = !showMoves;
  refresh();
}

export function getPhase(): Phase {
  return phase;
}

export function getHumanSide(): Side {
  return humanSide;
}

export function getShowMoves(): boolean {
  return showMoves;
}

export const chess: App = {
  name: "Chess",

  init(): void {
    active = true;
    newGame();
  },

  cleanup(): void {
    active = false;
    clearIllegalTimer();
  },

  onNoteOn(e: NoteMessageEvent): void {
    if (e.note.rawAttack <= 0) return;
    NOTE_HANDLERS[phase](e.note.number);
  },

  onControlChange(e: ControlChangeMessageEvent): void {
    const velocity = e.message.data[2] ?? 0;
    if (velocity <= 0) return;
    const controller = e.controller.number;
    if (isSetupDifficulty(controller)) setLevel(controller - 90);
    else if (controller === MOVES_TOGGLE_PAD) toggleShowMoves();
  },

  onControlChangeLongPress(e: ControlChangeMessageEvent): void {
    if (e.controller.number === NEW_GAME_PAD) newGame();
  },
};

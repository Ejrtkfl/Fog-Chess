import type { Chess, Move } from "chess.js";
import type { AiDifficulty } from "../game/types";
import { eloToLevel } from "./difficulty";

const PIECE_VALUE: Record<string, number> = {
  p: 1,
  n: 3,
  b: 3,
  r: 5,
  q: 9,
  k: 100,
};

function randomItem<T>(items: T[]): T {
  return items[Math.floor(Math.random() * items.length)];
}

function scoreMove(move: Move): number {
  let score = 0;

  if (move.captured) score += PIECE_VALUE[move.captured] * 10;
  if (move.promotion) score += PIECE_VALUE[move.promotion] * 8;
  if (move.san.includes("+")) score += 3;
  if (move.san.includes("#")) score += 999;

  return score;
}

export function getFallbackAiMove(chess: Chess, difficulty: AiDifficulty): Move | null {
  const moves = chess.moves({ verbose: true });
  if (moves.length === 0) return null;
  const level = eloToLevel(difficulty);

  if (level <= 2) {
    return randomItem(moves);
  }

  const sorted = [...moves].sort((a, b) => scoreMove(b) - scoreMove(a));

  if (level <= 5) {
    const top = sorted.slice(0, Math.min(8, sorted.length));
    return randomItem(top);
  }

  if (level <= 8) {
    const top = sorted.slice(0, Math.min(4, sorted.length));
    return randomItem(top);
  }

  return sorted[0];
}

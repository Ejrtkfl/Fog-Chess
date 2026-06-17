import type { AiDifficulty } from "../game/types";

export const AI_ELO_MIN = 1320;
export const AI_ELO_MAX = 2940;
export const AI_ELO_STEP = 10;
export const AI_ELO_DEFAULT = 2040;

export function clampAiElo(difficulty: AiDifficulty) {
  const rounded = Math.round(difficulty / AI_ELO_STEP) * AI_ELO_STEP;

  return Math.min(AI_ELO_MAX, Math.max(AI_ELO_MIN, rounded));
}

export function eloToLevel(difficulty: AiDifficulty) {
  const elo = clampAiElo(difficulty);
  const progress = (elo - AI_ELO_MIN) / (AI_ELO_MAX - AI_ELO_MIN);
  const level = Math.round(progress * 9) + 1;

  return Math.min(10, Math.max(1, level));
}

export function getDifficultyConfig(difficulty: AiDifficulty) {
  const elo = clampAiElo(difficulty);
  const level = eloToLevel(elo);

  return {
    elo,
    depth: Math.round(1 + (level - 1) * 1.4),
    movetime: Math.round(250 + (level - 1) * 180),
  };
}

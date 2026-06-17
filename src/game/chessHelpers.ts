import type { Square } from "chess.js";

export const FILES = ["a", "b", "c", "d", "e", "f", "g", "h"] as const;

export function getSquare(row: number, col: number, flipped: boolean): Square {
  const fileIndex = flipped ? 7 - col : col;
  const rank = flipped ? row + 1 : 8 - row;
  return `${FILES[fileIndex]}${rank}` as Square;
}

export function isLightSquare(row: number, col: number): boolean {
  return (row + col) % 2 === 0;
}

export function pieceToUnicode(piece: string, color: "w" | "b"): string {
  const white: Record<string, string> = {
    k: "♔",
    q: "♕",
    r: "♖",
    b: "♗",
    n: "♘",
    p: "♙",
  };

  const black: Record<string, string> = {
    k: "♚",
    q: "♛",
    r: "♜",
    b: "♝",
    n: "♞",
    p: "♟",
  };

  return color === "w" ? white[piece] : black[piece];
}

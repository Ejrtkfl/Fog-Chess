import type { Chess, Square } from "chess.js";
import type { FogMode } from "./types";

const FILES = ["a", "b", "c", "d", "e", "f", "g", "h"];

export type FogState = {
  mode: FogMode;
  visibleSquares: Set<string>;
  unknownEnemySquares: Set<string>;
  revealedCheckSquares: Set<string>;
  revealedKingSquares: Set<string>;
};

type FogOptions = {
  selectedSquare?: Square | null;
  allVisionBonus?: number;
  pawnVisionBonus?: number;
  revealLineOfSight?: boolean;
  revealFirstLineEnemyAura?: boolean;
  revealRoyalSquares?: boolean;
  revealRoyalAura?: boolean;
};

function getAllSquares(): Set<string> {
  const squares = new Set<string>();

  for (const file of FILES) {
    for (let rank = 1; rank <= 8; rank++) {
      squares.add(`${file}${rank}`);
    }
  }

  return squares;
}

export function getFogState(
  chess: Chess,
  color: "w" | "b",
  mode: FogMode,
  options: FogOptions = {}
): FogState {
  const selectedSquare = options.selectedSquare ?? null;
  const allVisionBonus = Math.max(0, Math.floor(options.allVisionBonus ?? 0));
  const pawnVisionBonus = Math.max(0, Math.floor(options.pawnVisionBonus ?? 0));

  if (mode === "off" || chess.isCheckmate()) {
    return {
      mode,
      visibleSquares: getAllSquares(),
      unknownEnemySquares: new Set(),
      revealedCheckSquares: new Set(),
      revealedKingSquares: new Set(),
    };
  }

  const visibleSquares = new Set<string>();
  const unknownEnemySquares = new Set<string>();
  const revealedCheckSquares = new Set<string>();
  const revealedKingSquares = new Set<string>();
  const board = chess.board();
  const opponentColor = color === "w" ? "b" : "w";

  for (let row = 0; row < 8; row++) {
    for (let col = 0; col < 8; col++) {
      const piece = board[row][col];
      if (!piece || piece.color !== color) continue;
      const visionRadius = 1 + allVisionBonus + (piece.type === "p" ? pawnVisionBonus : 0);

      for (let rowOffset = -visionRadius; rowOffset <= visionRadius; rowOffset++) {
        for (let colOffset = -visionRadius; colOffset <= visionRadius; colOffset++) {
          const nextRow = row + rowOffset;
          const nextCol = col + colOffset;

          if (nextRow < 0 || nextRow > 7 || nextCol < 0 || nextCol > 7) continue;
          visibleSquares.add(`${FILES[nextCol]}${8 - nextRow}`);
        }
      }

    }
  }

  if (selectedSquare) {
    const selectedPosition = squareToPosition(selectedSquare);
    const selectedPiece = board[selectedPosition.row][selectedPosition.col];

    if (selectedPiece?.color === color) {
      const pathEnemySquares = options.revealLineOfSight
        ? getPathEnemySquares(board, selectedPosition.row, selectedPosition.col, color, true)
        : getPathEnemySquares(board, selectedPosition.row, selectedPosition.col, color, false);

      for (const square of pathEnemySquares) {
        if (!visibleSquares.has(square)) unknownEnemySquares.add(square);
      }

      if (options.revealFirstLineEnemyAura) {
        const firstEnemySquares = getPathEnemySquares(
          board,
          selectedPosition.row,
          selectedPosition.col,
          color,
          false
        );

        for (const square of firstEnemySquares) {
          const position = squareToPosition(square);
          addArea(visibleSquares, position.row, position.col, 1);
        }

        for (const square of Array.from(unknownEnemySquares)) {
          if (visibleSquares.has(square)) unknownEnemySquares.delete(square);
        }
      }
    }
  }

  if (options.revealRoyalSquares || options.revealRoyalAura) {
    for (let row = 0; row < 8; row++) {
      for (let col = 0; col < 8; col++) {
        const piece = board[row][col];
        if (piece?.color !== opponentColor || (piece.type !== "q" && piece.type !== "k")) continue;

        if (options.revealRoyalAura) {
          addArea(visibleSquares, row, col, 1);
        } else {
          visibleSquares.add(`${FILES[col]}${8 - row}`);
        }
      }
    }
  }

  if (chess.isCheck() && chess.turn() === color) {
    const kingSquare = findKingSquare(chess, color);

    if (kingSquare) {
      const checkingSquares = chess.attackers(kingSquare, opponentColor);

      for (const square of checkingSquares) {
        visibleSquares.add(square);
        revealedCheckSquares.add(square);
        unknownEnemySquares.delete(square);
      }
    }
  }

  if (chess.isCheck() && chess.turn() === opponentColor) {
    const opponentKingSquare = findKingSquare(chess, opponentColor);

    if (opponentKingSquare) {
      visibleSquares.add(opponentKingSquare);
      revealedKingSquares.add(opponentKingSquare);
      unknownEnemySquares.delete(opponentKingSquare);
    }
  }

  return {
    mode,
    visibleSquares,
    unknownEnemySquares,
    revealedCheckSquares,
    revealedKingSquares,
  };
}

export function canSeeSquare(fogState: FogState, square: string): boolean {
  return fogState.visibleSquares.has(square);
}

function findKingSquare(chess: Chess, color: "w" | "b"): Square | null {
  const board = chess.board();

  for (let row = 0; row < 8; row++) {
    for (let col = 0; col < 8; col++) {
      const piece = board[row][col];

      if (piece?.type === "k" && piece.color === color) {
        return `${FILES[col]}${8 - row}` as Square;
      }
    }
  }

  return null;
}

function getPathEnemySquares(
  board: ReturnType<Chess["board"]>,
  row: number,
  col: number,
  color: "w" | "b",
  revealAllBehindFirst: boolean
): Square[] {
  const piece = board[row][col];
  if (!piece) return [];

  const enemyColor = color === "w" ? "b" : "w";
  const squares: Square[] = [];

  if (piece.type === "p") {
    const direction = color === "w" ? -1 : 1;
    addEnemyAt(board, row + direction, col - 1, enemyColor, squares);
    addEnemyAt(board, row + direction, col + 1, enemyColor, squares);
    return squares;
  }

  if (piece.type === "n") {
    for (const [rowOffset, colOffset] of [
      [-2, -1],
      [-2, 1],
      [-1, -2],
      [-1, 2],
      [1, -2],
      [1, 2],
      [2, -1],
      [2, 1],
    ]) {
      addEnemyAt(board, row + rowOffset, col + colOffset, enemyColor, squares);
    }

    return squares;
  }

  const directions: number[][] = [];

  if (piece.type === "k") {
    directions.push(
      [-1, -1],
      [-1, 0],
      [-1, 1],
      [0, -1],
      [0, 1],
      [1, -1],
      [1, 0],
      [1, 1]
    );
  }

  if (piece.type === "r" || piece.type === "q") {
    directions.push([-1, 0], [1, 0], [0, -1], [0, 1]);
  }

  if (piece.type === "b" || piece.type === "q") {
    directions.push([-1, -1], [-1, 1], [1, -1], [1, 1]);
  }

  for (const [rowOffset, colOffset] of directions) {
    let nextRow = row + rowOffset;
    let nextCol = col + colOffset;
    let foundFirstEnemy = false;

    while (isInsideBoard(nextRow, nextCol)) {
      const target = board[nextRow][nextCol];

      if (target?.color === enemyColor) {
        squares.push(`${FILES[nextCol]}${8 - nextRow}` as Square);
        if (!revealAllBehindFirst) break;
        foundFirstEnemy = true;
      } else if (target?.color === color && !foundFirstEnemy) {
        break;
      }

      if (piece.type === "k") break;
      nextRow += rowOffset;
      nextCol += colOffset;
    }
  }

  return squares;
}

function addEnemyAt(
  board: ReturnType<Chess["board"]>,
  row: number,
  col: number,
  enemyColor: "w" | "b",
  squares: Square[]
) {
  if (!isInsideBoard(row, col)) return;

  const target = board[row][col];
  if (target?.color === enemyColor) {
    squares.push(`${FILES[col]}${8 - row}` as Square);
  }
}

function isInsideBoard(row: number, col: number) {
  return row >= 0 && row <= 7 && col >= 0 && col <= 7;
}

function addArea(squares: Set<string>, row: number, col: number, radius: number) {
  for (let rowOffset = -radius; rowOffset <= radius; rowOffset++) {
    for (let colOffset = -radius; colOffset <= radius; colOffset++) {
      const nextRow = row + rowOffset;
      const nextCol = col + colOffset;

      if (!isInsideBoard(nextRow, nextCol)) continue;
      squares.add(`${FILES[nextCol]}${8 - nextRow}`);
    }
  }
}

function squareToPosition(square: Square) {
  return {
    row: 8 - Number(square[1]),
    col: FILES.indexOf(square[0]),
  };
}

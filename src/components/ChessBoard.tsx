import type { Chess, Square } from "chess.js";
import { getSquare, isLightSquare, pieceToUnicode } from "../game/chessHelpers";
import type { FogState } from "../game/fog";

type Props = {
  chess: Chess;
  selectedSquare: Square | null;
  legalTargets: string[];
  fogState: FogState;
  markerSquares?: {
    enemyFrom?: Square | null;
    enemyTo?: Square | null;
  };
  disabled?: boolean;
  flipped?: boolean;
  onSquareClick: (square: Square) => void;
};

export default function ChessBoard({
  chess,
  selectedSquare,
  legalTargets,
  fogState,
  markerSquares,
  disabled = false,
  flipped = false,
  onSquareClick,
}: Props) {
  const board = chess.board();

  return (
    <div className={`chess-board ${disabled ? "board-disabled" : ""}`}>
      {Array.from({ length: 8 }).map((_, row) =>
        Array.from({ length: 8 }).map((__, col) => {
          const square = getSquare(row, col, flipped);
          const boardRow = flipped ? 7 - row : row;
          const boardCol = flipped ? 7 - col : col;
          const piece = board[boardRow][boardCol];
          const canSee = fogState.visibleSquares.has(square);
          const showsUnknownEnemy = !canSee && fogState.unknownEnemySquares.has(square);
          const showsCheckAlert = fogState.revealedCheckSquares.has(square);
          const isRevealedKing = fogState.revealedKingSquares.has(square);
          const isEnemyFromMarker = markerSquares?.enemyFrom === square;
          const isEnemyToMarker = markerSquares?.enemyTo === square;
          const isSelected = selectedSquare === square;
          const isTarget = legalTargets.includes(square);

          return (
            <button
              key={square}
              className={[
                "square",
                isLightSquare(row, col) ? "light" : "dark",
                isSelected ? "selected" : "",
                isTarget ? "target" : "",
                !canSee ? "fogged" : "",
                showsUnknownEnemy ? "unknown-enemy-square" : "",
                showsCheckAlert ? "check-alert-square" : "",
                isRevealedKing ? "revealed-king-square" : "",
                isEnemyFromMarker ? "enemy-from-marker" : "",
                isEnemyToMarker ? "enemy-to-marker" : "",
              ].join(" ")}
              onClick={() => onSquareClick(square)}
              disabled={disabled}
              title={square}
            >
              <span className="coord">{square}</span>
              {piece && canSee ? (
                <span className={`piece ${piece.color === "w" ? "white-piece" : "black-piece"}`}>
                  {pieceToUnicode(piece.type, piece.color)}
                </span>
              ) : null}
              {showsUnknownEnemy ? <span className="unknown-enemy">?</span> : null}
              {isEnemyFromMarker ? <span className="move-marker from-marker" /> : null}
              {isEnemyToMarker ? <span className="move-marker to-marker" /> : null}
              {showsCheckAlert ? <span className="check-alert">!</span> : null}
            </button>
          );
        })
      )}
    </div>
  );
}

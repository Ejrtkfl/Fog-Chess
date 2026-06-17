import type { AiDifficulty } from "../game/types";
import { getDifficultyConfig } from "./difficulty";

export async function getStockfishBestMove(
  fen: string,
  difficulty: AiDifficulty
): Promise<string | null> {
  const config = getDifficultyConfig(difficulty);

  return new Promise((resolve) => {
    let done = false;
    let worker: Worker | null = null;

    const finish = (move: string | null) => {
      if (done) return;
      done = true;
      if (worker) worker.terminate();
      resolve(move);
    };

    try {
      worker = new Worker(`${import.meta.env.BASE_URL}stockfish/stockfish.js`);
    } catch {
      finish(null);
      return;
    }

    const timeout = window.setTimeout(() => {
      finish(null);
    }, config.movetime + 4000);

    worker.onerror = () => {
      window.clearTimeout(timeout);
      finish(null);
    };

    worker.onmessage = (event) => {
      const line = String(event.data);

      if (line.startsWith("bestmove")) {
        window.clearTimeout(timeout);
        const move = line.split(" ")[1];
        finish(move && move !== "(none)" ? move : null);
      }
    };

    worker.postMessage("uci");
    worker.postMessage("setoption name UCI_LimitStrength value true");
    worker.postMessage(`setoption name UCI_Elo value ${config.elo}`);
    worker.postMessage("isready");
    worker.postMessage(`position fen ${fen}`);
    worker.postMessage(`go depth ${config.depth} movetime ${config.movetime}`);
  });
}

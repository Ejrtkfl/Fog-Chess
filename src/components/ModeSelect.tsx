import { useEffect, useState } from "react";
import type { AiDifficulty, FogMode, GameMode } from "../game/types";
import { AI_ELO_MAX, AI_ELO_MIN, AI_ELO_STEP, clampAiElo } from "../ai/difficulty";

type Props = {
  mode: GameMode;
  difficulty: AiDifficulty;
  fogMode: FogMode;
  roomCode: string;
  roomJoined: boolean;
  multiplayerConnected: boolean;
  gameStarted: boolean;
  localReady: boolean;
  opponentReady: boolean;
  joiningRoom: boolean;
  readyLocked: boolean;
  onModeChange: (mode: GameMode) => void;
  onDifficultyChange: (difficulty: AiDifficulty) => void;
  onFogModeChange: (fogMode: FogMode) => void;
  onRoomCodeChange: (roomCode: string) => void;
  onJoinRoom: () => void;
  onLeaveRoom: () => void;
  onReadyToggle: () => void;
  onStartGame: () => void;
  onNewGame: () => void;
};

export default function ModeSelect({
  mode,
  difficulty,
  fogMode,
  roomCode,
  roomJoined,
  multiplayerConnected,
  gameStarted,
  localReady,
  opponentReady,
  joiningRoom,
  readyLocked,
  onModeChange,
  onDifficultyChange,
  onFogModeChange,
  onRoomCodeChange,
  onJoinRoom,
  onLeaveRoom,
  onReadyToggle,
  onStartGame,
  onNewGame,
}: Props) {
  const currentElo = clampAiElo(difficulty);
  const [eloInput, setEloInput] = useState(String(currentElo));

  useEffect(() => {
    setEloInput(String(currentElo));
  }, [currentElo]);

  function commitEloInput(value: string) {
    const nextElo = Number(value);

    if (!Number.isFinite(nextElo)) {
      setEloInput(String(currentElo));
      return;
    }

    const clampedElo = clampAiElo(nextElo);
    setEloInput(String(clampedElo));
    onDifficultyChange(clampedElo);
  }

  const readyCount = (localReady ? 1 : 0) + (opponentReady ? 1 : 0);

  return (
    <section className="panel controls">
      <div>
        <label>게임 모드</label>
        <div className="button-row">
          <button
            className={mode === "ai" ? "active" : ""}
            onClick={() => onModeChange("ai")}
            disabled={roomJoined}
          >
            VS AI
          </button>
          <button
            className={mode === "multiplayer" ? "active" : ""}
            onClick={() => onModeChange("multiplayer")}
          >
            멀티플레이
          </button>
        </div>
      </div>

      {mode === "ai" ? (
        <div>
          <div className="range-label">
            <label htmlFor="ai-elo">AI 난이도</label>
            <div className="elo-input-wrap">
              <span>ELO</span>
              <input
                className="elo-input"
                type="number"
                min={AI_ELO_MIN}
                max={AI_ELO_MAX}
                step={AI_ELO_STEP}
                value={eloInput}
                onChange={(event) => setEloInput(event.target.value)}
                onBlur={(event) => commitEloInput(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === "Enter") {
                    commitEloInput(event.currentTarget.value);
                    event.currentTarget.blur();
                  }
                }}
                aria-label="AI ELO 직접 입력"
              />
              <div className="elo-help">
                <button type="button" aria-label="ELO별 난이도 안내">i</button>
                <div className="elo-tooltip" role="tooltip">
                  <p>1320-1590 입문</p>
                  <p>1600-1890 초급</p>
                  <p>1900-2190 중급</p>
                  <p>2200-2490 상급</p>
                  <p>2500-2940 전문가</p>
                </div>
              </div>
            </div>
          </div>
          <input
            id="ai-elo"
            type="range"
            min={AI_ELO_MIN}
            max={AI_ELO_MAX}
            step={AI_ELO_STEP}
            value={currentElo}
            onChange={(event) => onDifficultyChange(Number(event.target.value))}
          />
          <div className="range-scale" aria-hidden="true">
            <span>{AI_ELO_MIN}</span>
            <span>{AI_ELO_MAX}</span>
          </div>
        </div>
      ) : (
        <div className="room-controls">
          <label htmlFor="room-code">방 코드</label>
          <div className={`room-join-row ${roomJoined ? "room-locked" : ""}`}>
            <input
              id="room-code"
              className="room-code-input"
              value={roomCode}
              onChange={(event) => onRoomCodeChange(event.target.value.replace(/\D/g, "").slice(0, 4))}
              placeholder="0000"
              inputMode="numeric"
              maxLength={4}
              disabled={roomJoined}
            />
            <button
              onClick={roomJoined ? onLeaveRoom : onJoinRoom}
              disabled={joiningRoom || (roomJoined && localReady && !gameStarted)}
            >
              {roomJoined ? "나가기" : "참가"}
            </button>
          </div>
        </div>
      )}

      <div className="action-row">
        {mode === "ai" ? (
          <>
            <button
              className={`fog-toggle ${fogMode === "fog" ? "active" : ""}`}
              onClick={() => onFogModeChange(fogMode === "fog" ? "off" : "fog")}
            >
              안개 {fogMode === "fog" ? "ON" : "OFF"}
            </button>
            <button className="new-game" onClick={onNewGame}>
              새 게임
            </button>
          </>
        ) : (
          <>
            <button
              className="fog-toggle"
              onClick={onStartGame}
              disabled={!roomJoined || !multiplayerConnected || gameStarted || readyCount < 2}
            >
              시작({readyCount}/2)
            </button>
            <button
              className={`new-game ${localReady ? "ready-active" : ""}`}
              onClick={onReadyToggle}
              disabled={!roomJoined || !multiplayerConnected || gameStarted || readyLocked}
            >
              {localReady ? "Ready" : "Ready"}
            </button>
          </>
        )}
      </div>
    </section>
  );
}

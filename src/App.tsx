import { useEffect, useMemo, useRef, useState } from "react";
import { Chess, type Move, type Square } from "chess.js";
import { getFallbackAiMove } from "./ai/simpleFallbackAi";
import { getStockfishBestMove } from "./ai/stockfishClient";
import ChessBoard from "./components/ChessBoard";
import ModeSelect from "./components/ModeSelect";
import { getFogState } from "./game/fog";
import { pieceToUnicode } from "./game/chessHelpers";
import type { AiDifficulty, FogMode, GameMode, PeerMessage, PlayerColor } from "./game/types";
import { AI_ELO_DEFAULT } from "./ai/difficulty";
import { hasFirebaseConfig } from "./firebase";
import { WebRtcClient } from "./multiplayer/webrtcClient";
import {
  addGuestCandidate,
  addHostCandidate,
  createRoomWithId,
  deleteRoom,
  getRoom,
  saveAnswer,
  watchAnswer,
  watchGuestCandidates,
  watchHostCandidates,
  type RoomData,
} from "./multiplayer/firebaseSignaling";
import moveSoundUrl from "./sounds/chess_move.mp3";
import exitSoundUrl from "./sounds/exit.mp3";
import joinSoundUrl from "./sounds/join.mp3";
import warnSoundUrl from "./sounds/warn.mp3";

type CapturedPieces = {
  w: string[];
  b: string[];
};

type EnemyMoveTrace = {
  from: Square;
  to: Square;
  piece: string;
} | null;

const SCORE_CELLS = [
  { key: "p", label: "폰", max: 8, value: 1, description: "4/8 : 폰 시야 +1\n8/8 : 폰 시야 +2\n♛ : 모든 기물에 시야 적용" },
  { key: "n", label: "나이트", max: 2, value: 3, description: "2/2 : 상대가 움직인 기물 위치 표시\n♛ : 상대가 움직인 기물의 시야를 얻음" },
  { key: "b", label: "비숍", max: 2, value: 3, description: "2/2 : 적 퀸과 킹의 시야를 얻음\n♛ : 적 퀸과 킹 주변 시야를 얻음" },
  { key: "r", label: "룩", max: 2, value: 5, description: "2/2 : 경로상 적의 위치를 모두 얻음\n♛ : 가려진 맨 앞 시야를 얻음" },
  { key: "q", label: "퀸", max: 1, value: 9, description: "능력 강화" },
] as const;

const SOUND_URLS = {
  move: moveSoundUrl,
  check: warnSoundUrl,
  join: joinSoundUrl,
  exit: exitSoundUrl,
} as const;

export default function App() {
  const [mode, setMode] = useState<GameMode>("ai");
  const [difficulty, setDifficulty] = useState<AiDifficulty>(AI_ELO_DEFAULT);
  const [fogMode, setFogMode] = useState<FogMode>("off");
  const [fen, setFen] = useState(new Chess().fen());
  const [selectedSquare, setSelectedSquare] = useState<Square | null>(null);
  const [message, setMessage] = useState("흰색 차례입니다. 말을 클릭해서 이동하세요.");
  const [aiThinking, setAiThinking] = useState(false);
  const [capturedPieces, setCapturedPieces] = useState<CapturedPieces>({ w: [], b: [] });
  const [enemyMoveTrace, setEnemyMoveTrace] = useState<EnemyMoveTrace>(null);
  const [roomCode, setRoomCode] = useState("");
  const [roomId, setRoomId] = useState("");
  const [playerColor, setPlayerColor] = useState<PlayerColor>("w");
  const [roomJoined, setRoomJoined] = useState(false);
  const [multiplayerConnected, setMultiplayerConnected] = useState(false);
  const [localReady, setLocalReady] = useState(false);
  const [opponentReady, setOpponentReady] = useState(false);
  const [gameStarted, setGameStarted] = useState(false);
  const [joiningRoom, setJoiningRoom] = useState(false);
  const [readyLocked, setReadyLocked] = useState(false);
  const peerRef = useRef<WebRtcClient | null>(null);
  const cleanupRef = useRef<Array<() => void>>([]);
  const playerColorRef = useRef<PlayerColor>("w");
  const roomIdRef = useRef("");
  const wasConnectedRef = useRef(false);
  const audioRef = useRef<Record<keyof typeof SOUND_URLS, HTMLAudioElement> | null>(null);
  const audioUnlockedRef = useRef(false);

  const chess = useMemo(() => new Chess(fen), [fen]);
  const isMultiplayer = mode === "multiplayer";
  const activeColor: PlayerColor = isMultiplayer ? playerColor : "w";
  const localCapturedColor: PlayerColor = activeColor === "w" ? "b" : "w";
  const boardDisabled =
    aiThinking ||
    chess.isGameOver() ||
    (isMultiplayer && (!gameStarted || chess.turn() !== playerColor));

  const legalTargets = useMemo(() => {
    if (!selectedSquare) return [];
    return chess.moves({ square: selectedSquare, verbose: true }).map((move) => move.to);
  }, [chess, selectedSquare]);

  const scoreCounts = useMemo(() => {
    return SCORE_CELLS.map((cell) => ({
      ...cell,
      count: capturedPieces[localCapturedColor].filter((piece) => piece === cell.key).length,
    }));
  }, [capturedPieces, localCapturedColor]);

  const totalScore = useMemo(() => {
    return scoreCounts.reduce((total, cell) => total + cell.count * cell.value, 0);
  }, [scoreCounts]);

  const scoreEffects = useMemo(() => {
    const pawnCount = scoreCounts.find((cell) => cell.key === "p")?.count ?? 0;
    const knightCount = scoreCounts.find((cell) => cell.key === "n")?.count ?? 0;
    const bishopCount = scoreCounts.find((cell) => cell.key === "b")?.count ?? 0;
    const rookCount = scoreCounts.find((cell) => cell.key === "r")?.count ?? 0;
    const queenCount = scoreCounts.find((cell) => cell.key === "q")?.count ?? 0;
    const hasQueenUpgrade = queenCount > 0;

    return {
      pawnVisionBonus: Math.floor(pawnCount / 4),
      allVisionBonus: hasQueenUpgrade ? Math.floor(pawnCount / 4) : 0,
      showsEnemyPieceType: knightCount >= 2,
      showsEnemyMoveSquares: hasQueenUpgrade && knightCount >= 2,
      revealsRoyalSquares: bishopCount >= 2,
      revealsRoyalAura: hasQueenUpgrade && bishopCount >= 2,
      revealsLineOfSight: rookCount >= 2,
      revealsFirstLineEnemyAura: hasQueenUpgrade && rookCount >= 2,
      hasQueenUpgrade,
    };
  }, [scoreCounts]);

  const fogState = useMemo(() => {
    return getFogState(chess, activeColor, isMultiplayer && !gameStarted ? "off" : fogMode, {
      selectedSquare,
      pawnVisionBonus: scoreEffects.pawnVisionBonus,
      allVisionBonus: scoreEffects.allVisionBonus,
      revealLineOfSight: scoreEffects.revealsLineOfSight,
      revealFirstLineEnemyAura: scoreEffects.revealsFirstLineEnemyAura,
      revealRoyalSquares: scoreEffects.revealsRoyalSquares,
      revealRoyalAura: scoreEffects.revealsRoyalAura,
    });
  }, [activeColor, chess, fogMode, gameStarted, isMultiplayer, selectedSquare, scoreEffects]);

  useEffect(() => {
    return () => {
      cleanupMultiplayer();
    };
  }, []);

  useEffect(() => {
    playerColorRef.current = playerColor;
  }, [playerColor]);

  useEffect(() => {
    roomIdRef.current = roomId;
  }, [roomId]);

  function cleanupMultiplayer() {
    cleanupRef.current.forEach((cleanup) => cleanup());
    cleanupRef.current = [];
    peerRef.current?.close();
    peerRef.current = null;
  }

  function resetReadyState() {
    setLocalReady(false);
    setOpponentReady(false);
    setReadyLocked(false);
  }

  function resetGame() {
    unlockAudio();
    const newGame = new Chess();
    setFen(newGame.fen());
    setSelectedSquare(null);
    setAiThinking(false);
    setCapturedPieces({ w: [], b: [] });
    setEnemyMoveTrace(null);
    setMessage("새 게임을 시작했습니다. 흰색 차례입니다.");
  }

  function resetLocalBoard(messageText = "새 게임을 시작했습니다. 흰색 차례입니다.") {
    const newGame = new Chess();
    setFen(newGame.fen());
    setSelectedSquare(null);
    setAiThinking(false);
    setCapturedPieces({ w: [], b: [] });
    setEnemyMoveTrace(null);
    setMessage(messageText);
  }

  function recordCapture(move: Move) {
    if (!move.captured) return;

    const capturedColor = move.color === "w" ? "b" : "w";
    setCapturedPieces((current) => ({
      ...current,
      [capturedColor]: [...current[capturedColor], move.captured],
    }));
  }

  function recordRemoteCapture(captured?: string, capturedColor?: PlayerColor) {
    if (!captured || !capturedColor) return;

    setCapturedPieces((current) => ({
      ...current,
      [capturedColor]: [...current[capturedColor], captured],
    }));
  }

  function updateStatus(next: Chess) {
    if (next.isCheckmate()) {
      setMessage(next.turn() === "w" ? "체크메이트! 검은색 승리" : "체크메이트! 흰색 승리");
      return;
    }

    if (next.isDraw()) {
      setMessage("무승부입니다.");
      return;
    }

    if (next.isCheck()) {
      setMessage(next.turn() === "w" ? "흰색 체크 상태입니다." : "검은색 체크 상태입니다.");
      return;
    }

    setMessage(next.turn() === "w" ? "흰색 차례입니다." : "검은색 차례입니다.");
  }

  function getAudioMap() {
    if (!audioRef.current) {
      audioRef.current = Object.entries(SOUND_URLS).reduce(
        (audios, [key, url]) => {
          const audio = new Audio(url);
          audio.preload = "auto";
          audio.volume = 0.55;
          audios[key as keyof typeof SOUND_URLS] = audio;
          return audios;
        },
        {} as Record<keyof typeof SOUND_URLS, HTMLAudioElement>
      );
    }

    return audioRef.current;
  }

  function unlockAudio() {
    if (audioUnlockedRef.current) return;
    audioUnlockedRef.current = true;

    const audios = getAudioMap();
    Object.values(audios).forEach((audio) => {
      audio.muted = true;
      audio
        .play()
        .then(() => {
          audio.pause();
          audio.currentTime = 0;
          audio.muted = false;
        })
        .catch(() => {
          audio.muted = false;
        });
    });
  }

  function playSound(sound: keyof typeof SOUND_URLS) {
    const audio = getAudioMap()[sound];
    audio.pause();
    audio.currentTime = 0;
    audio.muted = false;
    audio.volume = 0.55;
    audio.play().catch(() => {});
  }

  function updateStatusAndSound(next: Chess, checkedColor: PlayerColor = activeColor) {
    updateStatus(next);

    if (next.isCheck() && next.turn() === checkedColor) {
      playSound("check");
    }
  }

  function sendPeer(messageToSend: PeerMessage) {
    try {
      peerRef.current?.send(messageToSend);
    } catch {
      setMessage("상대와의 연결이 아직 준비되지 않았습니다.");
    }
  }

  function handlePeerMessage(received: PeerMessage) {
    if (received.type === "ready") {
      setOpponentReady(received.ready);
      setMessage(received.ready ? "상대가 준비했습니다." : "상대가 준비를 해제했습니다.");
      return;
    }

    if (received.type === "start") {
      setFen(received.fen);
      setSelectedSquare(null);
      setCapturedPieces({ w: [], b: [] });
      setEnemyMoveTrace(null);
      setGameStarted(true);
      setFogMode("fog");
      setMessage("게임을 시작했습니다.");
      return;
    }

    if (received.type === "resign") {
      setGameStarted(false);
      setFogMode("off");
      playSound("exit");
      setMessage(received.winner === playerColorRef.current ? "상대가 항복했습니다. 승리!" : "항복했습니다.");
      return;
    }

    if (received.type === "roomSound") {
      playSound(received.sound);
      if (received.sound === "exit") {
        wasConnectedRef.current = false;
        setMultiplayerConnected(false);
        resetReadyState();

        const currentRoomId = roomIdRef.current;
        if (!gameStarted && playerColorRef.current === "w" && currentRoomId) {
          setMessage("상대가 방에서 나갔습니다. 새 참가자를 기다립니다.");
          void setupHost(currentRoomId);
        } else {
          setMessage("상대가 방에서 나갔습니다.");
        }
      }
      return;
    }

    if (received.type === "move") {
      const next = new Chess(received.fenAfter);
      setFen(received.fenAfter);
      setSelectedSquare(null);
      setEnemyMoveTrace({
        from: received.from as Square,
        to: received.to as Square,
        piece: received.movedPiece ?? "",
      });
      recordRemoteCapture(received.captured, received.capturedColor);
      playSound("move");
      updateStatusAndSound(next, playerColorRef.current);
      return;
    }

    if (received.type === "sync") {
      setFen(received.fen);
      updateStatusAndSound(new Chess(received.fen), playerColorRef.current);
    }
  }

  function generateRoomCode() {
    return String(Math.floor(Math.random() * 10000)).padStart(4, "0");
  }

  function getOppositeColor(color: PlayerColor): PlayerColor {
    return color === "w" ? "b" : "w";
  }

  async function setupHost(code: string) {
    const hostColor: PlayerColor = "w";
    cleanupMultiplayer();
    const peer = new WebRtcClient();
    peerRef.current = peer;
    peer.onMessage = handlePeerMessage;
    peer.onOpen = () => {
      wasConnectedRef.current = true;
      setMultiplayerConnected(true);
      playSound("join");
      setMessage("상대가 연결되었습니다. 준비를 눌러주세요.");
    };
    peer.onClose = () => {
      if (wasConnectedRef.current) playSound("exit");
      wasConnectedRef.current = false;
      setMultiplayerConnected(false);
      resetReadyState();
      setMessage("상대와의 연결이 종료되었습니다.");
    };
    peer.onIceCandidate = (candidate) => {
      addHostCandidate(code, candidate.toJSON());
    };

    const offer = await peer.createOffer();
    await createRoomWithId(code, offer, hostColor);
    cleanupRef.current.push(
      watchAnswer(code, (answer) => {
        peer.acceptAnswer(answer);
      }),
      watchGuestCandidates(code, (candidate) => {
        peer.addIceCandidate(candidate);
      })
    );

    setPlayerColor(hostColor);
    setRoomId(code);
    setRoomCode(code);
    setRoomJoined(true);
    playSound("join");
    setMessage(`방 ${code}를 만들었습니다. 상대를 기다리는 중입니다.`);
  }

  async function setupGuest(code: string, room: RoomData) {
    const guestColor = getOppositeColor(room.hostColor ?? "w");
    cleanupMultiplayer();
    const peer = new WebRtcClient();
    peerRef.current = peer;
    peer.onMessage = handlePeerMessage;
    peer.onOpen = () => {
      wasConnectedRef.current = true;
      setMultiplayerConnected(true);
      playSound("join");
      setMessage("방에 연결되었습니다. 준비를 눌러주세요.");
    };
    peer.onClose = () => {
      if (wasConnectedRef.current) playSound("exit");
      wasConnectedRef.current = false;
      setMultiplayerConnected(false);
      resetReadyState();
      setMessage("상대와의 연결이 종료되었습니다.");
    };
    peer.onIceCandidate = (candidate) => {
      addGuestCandidate(code, candidate.toJSON());
    };

    const answer = await peer.createAnswer(room.offer);
    await saveAnswer(code, answer);
    cleanupRef.current.push(
      watchHostCandidates(code, (candidate) => {
        peer.addIceCandidate(candidate);
      })
    );

    setPlayerColor(guestColor);
    setRoomId(code);
    setRoomCode(code);
    setRoomJoined(true);
    setMessage(`방 ${code}에 참가했습니다.`);
  }

  async function handleJoinRoom() {
    unlockAudio();
    if (joiningRoom || roomJoined) return;

    if (!hasFirebaseConfig()) {
      setMessage(".env Firebase 설정을 먼저 입력해야 합니다.");
      return;
    }

    const code = (roomCode.trim() || generateRoomCode()).replace(/\D/g, "").slice(0, 4).padStart(4, "0");

    try {
      setJoiningRoom(true);
      const room = await getRoom(code);
      if (room.answer) {
        setMessage(`방 ${code}는 이미 가득 찼습니다.`);
        return;
      }
      await setupGuest(code, room);
    } catch {
      await setupHost(code);
    } finally {
      setJoiningRoom(false);
    }
  }

  function startMultiplayerGame() {
    unlockAudio();
    if (!roomJoined || !multiplayerConnected || gameStarted || !localReady || !opponentReady) return;

    const startFen = new Chess().fen();
    setFen(startFen);
    setSelectedSquare(null);
    setCapturedPieces({ w: [], b: [] });
    setEnemyMoveTrace(null);
    setGameStarted(true);
    setFogMode("fog");
    setMessage("양쪽 준비 완료. 게임을 시작했습니다.");
    sendPeer({ type: "start", fen: startFen });
  }

  function handleReadyToggle() {
    unlockAudio();
    if (readyLocked || !roomJoined || !multiplayerConnected || gameStarted) return;

    setReadyLocked(true);
    const nextReady = !localReady;
    setLocalReady(nextReady);
    sendPeer({ type: "ready", ready: nextReady });

    window.setTimeout(() => setReadyLocked(false), 350);
  }

  function handleLeaveRoom() {
    unlockAudio();
    if (gameStarted) {
      const winner = playerColor === "w" ? "b" : "w";
      sendPeer({ type: "resign", winner });
      playSound("exit");
      setGameStarted(false);
      setFogMode("off");
      setMessage("항복했습니다.");
      return;
    }

    sendPeer({ type: "roomSound", sound: "exit" });
    playSound("exit");
    wasConnectedRef.current = false;
    cleanupMultiplayer();
    if (roomId && playerColor === "w") {
      deleteRoom(roomId);
    }
    setRoomId("");
    setRoomCode("");
    setRoomJoined(false);
    setMultiplayerConnected(false);
    setLocalReady(false);
    setOpponentReady(false);
    setGameStarted(false);
    setJoiningRoom(false);
    setReadyLocked(false);
    setMessage("방에서 나왔습니다.");
  }

  async function runAiMove(currentFen: string) {
    const current = new Chess(currentFen);
    if (current.isGameOver()) return;

    setAiThinking(true);
    setMessage("AI가 수를 계산하는 중입니다...");

    try {
      const bestMove = await getStockfishBestMove(current.fen(), difficulty);
      const next = new Chess(current.fen());

      if (bestMove) {
        const from = bestMove.slice(0, 2) as Square;
        const to = bestMove.slice(2, 4) as Square;
        const promotion = bestMove.length >= 5 ? bestMove[4] : "q";
        const move = next.move({ from, to, promotion });

        if (move) {
          setEnemyMoveTrace({ from: move.from, to: move.to, piece: move.piece });
          recordCapture(move);
          setFen(next.fen());
          playSound("move");
          updateStatusAndSound(next, "w");
          return;
        }
      }

      const fallbackMove = getFallbackAiMove(next, difficulty);
      if (fallbackMove) {
        const move = next.move({ from: fallbackMove.from, to: fallbackMove.to, promotion: "q" });
        if (move) {
          setEnemyMoveTrace({ from: move.from, to: move.to, piece: move.piece });
          recordCapture(move);
          setFen(next.fen());
          playSound("move");
          updateStatusAndSound(next, "w");
        }
      }
    } finally {
      setAiThinking(false);
    }
  }

  function handleSquareClick(square: Square) {
    unlockAudio();
    if (aiThinking) return;

    if (isMultiplayer && !gameStarted) {
      setMessage("양쪽 모두 준비하면 게임을 시작합니다.");
      return;
    }

    if (chess.turn() !== activeColor) {
      setMessage(isMultiplayer ? "상대 차례입니다." : "현재는 AI 차례입니다.");
      return;
    }

    const clickedPiece = chess.get(square);

    if (!selectedSquare) {
      if (!clickedPiece) return;
      if (clickedPiece.color !== activeColor) {
        setMessage(isMultiplayer ? "자신의 말만 움직일 수 있습니다." : "플레이어는 흰색 말만 움직입니다.");
        return;
      }

      setSelectedSquare(square);
      return;
    }

    if (selectedSquare === square) {
      setSelectedSquare(null);
      return;
    }

    if (clickedPiece?.color === activeColor) {
      setSelectedSquare(square);
      return;
    }

    if (isMultiplayer && clickedPiece?.type === "k" && clickedPiece.color !== activeColor) {
      const canCaptureKing = chess.attackers(square, activeColor).includes(selectedSquare);

      if (canCaptureKing) {
        setSelectedSquare(null);
        setGameStarted(false);
        setFogMode("off");
        playSound("move");
        setMessage("상대 킹을 잡았습니다. 승리!");
        sendPeer({ type: "resign", winner: activeColor });
        return;
      }
    }

    if (!legalTargets.includes(square)) {
      setMessage(chess.isCheck() ? "체크를 해소할 수 있는 수만 둘 수 있습니다." : "그 위치로는 이동할 수 없습니다.");
      return;
    }

    const next = new Chess(chess.fen());
    const move = next.move({ from: selectedSquare, to: square, promotion: "q" });

    if (!move) {
      setMessage("그 위치로는 이동할 수 없습니다.");
      return;
    }

    setSelectedSquare(null);
    recordCapture(move);
    setFen(next.fen());
    playSound("move");
    updateStatusAndSound(next, activeColor);

    if (isMultiplayer) {
      sendPeer({
        type: "move",
        from: move.from,
        to: move.to,
        promotion: isPromotionPiece(move.promotion) ? move.promotion : undefined,
        fenAfter: next.fen(),
        ply: next.history().length,
        captured: move.captured,
        capturedColor: move.captured ? (move.color === "w" ? "b" : "w") : undefined,
        movedPiece: move.piece,
      });
      return;
    }

    if (!next.isGameOver()) {
      window.setTimeout(() => runAiMove(next.fen()), 1000);
    }
  }

  return (
    <main className="app">
      <header className="hero">
        <div>
          <p className="eyebrow">Web Chess Project</p>
          <h1>Fog Chess</h1>
        </div>
      </header>

      <div className="layout">
        <div className="board-area">
          <ChessBoard
            chess={chess}
            selectedSquare={selectedSquare}
            legalTargets={legalTargets}
            fogState={fogState}
            markerSquares={{
              enemyFrom: scoreEffects.showsEnemyMoveSquares ? enemyMoveTrace?.from ?? null : null,
              enemyTo: scoreEffects.showsEnemyMoveSquares ? enemyMoveTrace?.to ?? null : null,
            }}
            disabled={boardDisabled}
            flipped={isMultiplayer && playerColor === "b"}
            onSquareClick={handleSquareClick}
          />
          {isMultiplayer && !gameStarted ? (
            <div className="pre-game-overlay">
              <span>{multiplayerConnected ? "준비 대기 중" : "방 연결 대기 중"}</span>
            </div>
          ) : null}
        </div>

        <aside className="side">
          <ModeSelect
            mode={mode}
            difficulty={difficulty}
            fogMode={fogMode}
            onModeChange={setMode}
            onDifficultyChange={setDifficulty}
            onFogModeChange={setFogMode}
            roomCode={roomCode}
            roomJoined={roomJoined}
            multiplayerConnected={multiplayerConnected}
            gameStarted={gameStarted}
            localReady={localReady}
            opponentReady={opponentReady}
            joiningRoom={joiningRoom}
            readyLocked={readyLocked}
            onRoomCodeChange={setRoomCode}
            onJoinRoom={handleJoinRoom}
            onLeaveRoom={handleLeaveRoom}
            onReadyToggle={handleReadyToggle}
            onStartGame={startMultiplayerGame}
            onNewGame={resetGame}
          />

          <section className="panel status-panel">
            <h2>게임 상태</h2>
            <p>{message}</p>
            {scoreEffects.showsEnemyPieceType && enemyMoveTrace ? (
              <p className="enemy-piece-info">
                상대 이동 기물: <span className="black-piece">{pieceToUnicode(enemyMoveTrace.piece, "b")}</span>
              </p>
            ) : null}

            <div className="captured-panel">
              <p className="section-title">잡힌 기물</p>
              <CapturedRow label="흰색" color="w" pieces={capturedPieces.w} />
              <CapturedRow label="검은색" color="b" pieces={capturedPieces.b} />
            </div>

            <div className="score-grid" aria-label="score칸">
              {scoreCounts.map((cell) => (
                <div key={cell.key} className="score-cell">
                  <span className={`score-piece ${localCapturedColor === "w" ? "white-piece" : "black-piece"}`}>
                    {pieceToUnicode(cell.key, localCapturedColor)}
                  </span>
                  <span className="score-count">{cell.count}/{cell.max}</span>
                  <span className="score-tooltip">{cell.description}</span>
                </div>
              ))}
              <div className="score-cell total-score-cell">
                <span className="total-score-label">총점</span>
                <strong>{totalScore}</strong>
                <span className="score-tooltip">총점: 잡은 검은 기물 점수 합계</span>
              </div>
            </div>
          </section>
        </aside>
      </div>
    </main>
  );
}

function CapturedRow({
  label,
  color,
  pieces,
}: {
  label: string;
  color: "w" | "b";
  pieces: string[];
}) {
  return (
    <div className="captured-row">
      <span>{label}</span>
      <div className="captured-pieces">
        {pieces.length > 0 ? (
          pieces.map((piece, index) => (
            <span key={`${piece}-${index}`} className={color === "w" ? "white-piece" : "black-piece"}>
              {pieceToUnicode(piece, color)}
            </span>
          ))
        ) : (
          <em>없음</em>
        )}
      </div>
    </div>
  );
}

function isPromotionPiece(piece: string | undefined): piece is "q" | "r" | "b" | "n" {
  return piece === "q" || piece === "r" || piece === "b" || piece === "n";
}

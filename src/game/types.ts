export type GameMode = "ai" | "multiplayer";
export type PlayerColor = "w" | "b";
export type AiDifficulty = number;
export type FogMode = "off" | "fog";

export type MoveMessage = {
  type: "move";
  from: string;
  to: string;
  promotion?: "q" | "r" | "b" | "n";
  fenAfter: string;
  ply: number;
  captured?: string;
  capturedColor?: PlayerColor;
  movedPiece?: string;
};

export type SyncMessage = {
  type: "sync";
  fen: string;
  ply: number;
};

export type ReadyMessage = {
  type: "ready";
  ready: boolean;
};

export type StartMessage = {
  type: "start";
  fen: string;
};

export type ResignMessage = {
  type: "resign";
  winner: PlayerColor;
};

export type RoomSoundMessage = {
  type: "roomSound";
  sound: "join" | "exit";
};

export type PeerMessage =
  | MoveMessage
  | SyncMessage
  | ReadyMessage
  | StartMessage
  | ResignMessage
  | RoomSoundMessage;

import { get, onValue, push, ref, remove, set } from "firebase/database";
import { getFirebaseDatabase } from "../firebase";
import type { PlayerColor } from "../game/types";

export type RoomData = {
  offer: RTCSessionDescriptionInit;
  answer?: RTCSessionDescriptionInit;
  hostColor?: PlayerColor;
  createdAt: number;
};

export async function createRoom(offer: RTCSessionDescriptionInit, hostColor: PlayerColor = "w") {
  const database = getFirebaseDatabase();
  const roomRef = push(ref(database, "rooms"));

  await set(roomRef, {
    offer,
    hostColor,
    createdAt: Date.now(),
  });

  return roomRef.key!;
}

export async function createRoomWithId(
  roomId: string,
  offer: RTCSessionDescriptionInit,
  hostColor: PlayerColor = "w"
) {
  const database = getFirebaseDatabase();

  await set(ref(database, `rooms/${roomId}`), {
    offer,
    hostColor,
    createdAt: Date.now(),
  });

  return roomId;
}

export async function getRoom(roomId: string): Promise<RoomData> {
  const database = getFirebaseDatabase();
  const snapshot = await get(ref(database, `rooms/${roomId}`));

  if (!snapshot.exists()) {
    throw new Error("방을 찾을 수 없습니다.");
  }

  return snapshot.val();
}

export async function saveAnswer(roomId: string, answer: RTCSessionDescriptionInit) {
  const database = getFirebaseDatabase();
  await set(ref(database, `rooms/${roomId}/answer`), answer);
}

export function watchAnswer(roomId: string, callback: (answer: RTCSessionDescriptionInit) => void) {
  const database = getFirebaseDatabase();
  return onValue(ref(database, `rooms/${roomId}/answer`), (snapshot) => {
    if (snapshot.exists()) callback(snapshot.val());
  });
}

export async function addHostCandidate(roomId: string, candidate: RTCIceCandidateInit) {
  const database = getFirebaseDatabase();
  await push(ref(database, `rooms/${roomId}/hostCandidates`), candidate);
}

export async function addGuestCandidate(roomId: string, candidate: RTCIceCandidateInit) {
  const database = getFirebaseDatabase();
  await push(ref(database, `rooms/${roomId}/guestCandidates`), candidate);
}

export function watchHostCandidates(
  roomId: string,
  callback: (candidate: RTCIceCandidateInit) => void
) {
  const database = getFirebaseDatabase();
  return onValue(ref(database, `rooms/${roomId}/hostCandidates`), (snapshot) => {
    snapshot.forEach((child) => {
      callback(child.val());
    });
  });
}

export function watchGuestCandidates(
  roomId: string,
  callback: (candidate: RTCIceCandidateInit) => void
) {
  const database = getFirebaseDatabase();
  return onValue(ref(database, `rooms/${roomId}/guestCandidates`), (snapshot) => {
    snapshot.forEach((child) => {
      callback(child.val());
    });
  });
}

export async function deleteRoom(roomId: string) {
  const database = getFirebaseDatabase();
  await remove(ref(database, `rooms/${roomId}`));
}

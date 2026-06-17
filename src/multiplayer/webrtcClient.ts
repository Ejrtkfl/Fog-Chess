import type { PeerMessage } from "../game/types";

export class WebRtcClient {
  private pc: RTCPeerConnection;
  private channel: RTCDataChannel | null = null;

  onMessage?: (message: PeerMessage) => void;
  onOpen?: () => void;
  onClose?: () => void;
  onIceCandidate?: (candidate: RTCIceCandidate) => void;

  constructor() {
    this.pc = new RTCPeerConnection({
      iceServers: [{ urls: "stun:stun.l.google.com:19302" }],
    });

    this.pc.onicecandidate = (event) => {
      if (event.candidate) this.onIceCandidate?.(event.candidate);
    };

    this.pc.ondatachannel = (event) => {
      this.setChannel(event.channel);
    };
  }

  createChannel() {
    const channel = this.pc.createDataChannel("chess", { ordered: true });
    this.setChannel(channel);
  }

  private setChannel(channel: RTCDataChannel) {
    this.channel = channel;

    this.channel.onopen = () => this.onOpen?.();
    this.channel.onclose = () => this.onClose?.();
    this.channel.onmessage = (event) => {
      const message = JSON.parse(event.data) as PeerMessage;
      this.onMessage?.(message);
    };
  }

  send(message: PeerMessage) {
    if (!this.channel || this.channel.readyState !== "open") {
      throw new Error("P2P 연결이 아직 열리지 않았습니다.");
    }

    this.channel.send(JSON.stringify(message));
  }

  async createOffer() {
    this.createChannel();
    const offer = await this.pc.createOffer();
    await this.pc.setLocalDescription(offer);
    return offer;
  }

  async createAnswer(offer: RTCSessionDescriptionInit) {
    await this.pc.setRemoteDescription(offer);
    const answer = await this.pc.createAnswer();
    await this.pc.setLocalDescription(answer);
    return answer;
  }

  async acceptAnswer(answer: RTCSessionDescriptionInit) {
    await this.pc.setRemoteDescription(answer);
  }

  async addIceCandidate(candidate: RTCIceCandidateInit) {
    await this.pc.addIceCandidate(candidate);
  }

  close() {
    this.channel?.close();
    this.pc.close();
  }
}

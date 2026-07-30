// Mostek WebRTC do HeyGen LiveAvatar (tryb A). Cała autoryzacja odbywa się
// na backendzie (/api/heygen/*) — przeglądarka wymienia wyłącznie SDP/ICE.

export class AvatarSession {
  constructor(videoElement) {
    this.video = videoElement;
    this.peer = null;
    this.sessionId = null;
    this.active = false;
  }

  async start() {
    const sessionResponse = await fetch('/api/heygen/session', { method: 'POST' });
    if (!sessionResponse.ok) throw new Error('Nie udało się utworzyć sesji awatara');
    const data = await sessionResponse.json();

    this.sessionId = data.session_id;
    const iceServers = data.ice_servers2 ?? data.ice_servers ?? [];

    this.peer = new RTCPeerConnection({ iceServers });

    this.peer.ontrack = (event) => {
      if (event.streams?.[0]) this.video.srcObject = event.streams[0];
    };

    this.peer.onicecandidate = (event) => {
      if (!event.candidate) return;
      fetch('/api/heygen/ice', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ session_id: this.sessionId, candidate: event.candidate.toJSON() }),
      }).catch(() => {});
    };

    await this.peer.setRemoteDescription(new RTCSessionDescription(data.sdp));
    const answer = await this.peer.createAnswer();
    await this.peer.setLocalDescription(answer);

    const startResponse = await fetch('/api/heygen/start', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ session_id: this.sessionId, sdp: answer }),
    });
    if (!startResponse.ok) throw new Error('Nie udało się wystartować streamingu awatara');

    this.active = true;
  }

  /** Wysyła tekst do wypowiedzenia (HeyGen: TTS + lip-sync). */
  async speak(text) {
    if (!this.active) return;
    await fetch('/api/heygen/task', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ session_id: this.sessionId, text }),
    });
  }

  async stop() {
    this.active = false;
    if (this.sessionId) {
      await fetch('/api/heygen/stop', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ session_id: this.sessionId }),
      }).catch(() => {});
    }
    if (this.peer) this.peer.close();
    this.peer = null;
    this.sessionId = null;
    this.video.srcObject = null;
  }
}

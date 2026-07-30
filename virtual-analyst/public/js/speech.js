// SttAdapter — domyślna implementacja: Web Speech API (pl-PL), tryb ciągły.
// Zob. docs/RECENZJA.md pkt 1.1 — transkrypcja po stronie przeglądarki,
// do backendu trafia gotowy tekst.

export class SpeechAdapter {
  /**
   * @param {{onFinal: (text: string) => void, onInterim?: (text: string) => void, onStateChange?: (listening: boolean) => void}} handlers
   */
  constructor(handlers) {
    this.handlers = handlers;
    this.listening = false;
    this.recognition = null;

    const Recognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    this.supported = Boolean(Recognition);
    if (!this.supported) return;

    this.recognition = new Recognition();
    this.recognition.lang = 'pl-PL';
    this.recognition.continuous = true;
    this.recognition.interimResults = true;

    this.recognition.onresult = (event) => {
      let interim = '';
      for (let i = event.resultIndex; i < event.results.length; i += 1) {
        const result = event.results[i];
        if (result.isFinal) {
          const text = result[0].transcript.trim();
          if (text) this.handlers.onFinal(text);
        } else {
          interim += result[0].transcript;
        }
      }
      if (interim && this.handlers.onInterim) this.handlers.onInterim(interim.trim());
    };

    this.recognition.onend = () => {
      // Web Speech API potrafi samoistnie zakończyć sesję — wznawiamy, jeśli
      // użytkownik nie wyłączył mikrofonu.
      if (this.listening) {
        try {
          this.recognition.start();
        } catch {
          /* start w trakcie działania — ignoruj */
        }
      } else if (this.handlers.onStateChange) {
        this.handlers.onStateChange(false);
      }
    };

    this.recognition.onerror = (event) => {
      if (event.error === 'not-allowed' || event.error === 'service-not-allowed') {
        this.listening = false;
        if (this.handlers.onStateChange) this.handlers.onStateChange(false);
      }
    };
  }

  start() {
    if (!this.supported || this.listening) return;
    this.listening = true;
    this.recognition.start();
    if (this.handlers.onStateChange) this.handlers.onStateChange(true);
  }

  stop() {
    if (!this.supported || !this.listening) return;
    this.listening = false;
    this.recognition.stop();
    if (this.handlers.onStateChange) this.handlers.onStateChange(false);
  }

  toggle() {
    if (this.listening) this.stop();
    else this.start();
  }
}

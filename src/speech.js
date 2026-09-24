// Web Speech API wrapper. Kept deliberately thin: two callbacks in, nothing
// else. The caller decides what "final" means for the render pipeline.

const SpeechRecognitionImpl =
  window.SpeechRecognition || window.webkitSpeechRecognition || null;

export function isSpeechSupported() {
  return Boolean(SpeechRecognitionImpl);
}

export function createSpeechController({ onInterim, onFinal, onStateChange, onUnavailable }) {
  if (!SpeechRecognitionImpl) {
    return { supported: false, start() {}, stop() {}, toggle() {} };
  }

  const recognition = new SpeechRecognitionImpl();
  recognition.continuous = true;
  recognition.interimResults = true;
  recognition.lang = navigator.language || "fr-FR";

  let listening = false;

  recognition.onresult = (event) => {
    let interim = "";
    for (let i = event.resultIndex; i < event.results.length; i++) {
      const result = event.results[i];
      const text = result[0].transcript.trim();
      if (result.isFinal) {
        if (text) onFinal(text);
      } else {
        interim += text;
      }
    }
    if (interim) onInterim(interim);
  };

  recognition.onend = () => {
    if (listening) {
      // browsers stop the stream on silence; keep the session alive
      try {
        recognition.start();
      } catch {
        /* already starting */
      }
    }
  };

  recognition.onerror = (event) => {
    if (["not-allowed", "service-not-allowed", "audio-capture"].includes(event.error)) {
      listening = false;
      onStateChange(false);
      onUnavailable();
    }
  };

  return {
    supported: true,
    start() {
      if (listening) return;
      listening = true;
      try {
        recognition.start();
      } catch {
        /* already started */
      }
      onStateChange(true);
    },
    stop() {
      if (!listening) return;
      listening = false;
      recognition.stop();
      onStateChange(false);
    },
    toggle() {
      if (listening) this.stop();
      else this.start();
    },
  };
}

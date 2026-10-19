"use client";

import { useCallback, useEffect, useRef, useState } from "react";

// Free voice in the browser (Web Speech API): speech to text and text to speech, no server involved.
// Serbian (sr-RS) is tried first; if the browser has no Serbian, Croatian (hr-HR) is close enough to be understood.

interface SpeechResultList {
  length: number;
  [index: number]: { isFinal: boolean; 0: { transcript: string } };
}
interface Recognition {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  onresult: ((e: { resultIndex: number; results: SpeechResultList }) => void) | null;
  onerror: ((e: { error: string }) => void) | null;
  onend: (() => void) | null;
  start(): void;
  stop(): void;
  abort(): void;
}
type RecognitionCtor = new () => Recognition;

const PRIMARY_LANG = "sr-RS";
const FALLBACK_LANG = "hr-HR";
const WAKE = /(?:^|[^\p{L}])(?:todor[eau]?|teodor[e]?|тодор[еау]?)(?![\p{L}])/iu;

/** Wake word "Todore": what was said after it ("" if only the name was said), or null when it was not said. */
export function afterWakeWord(text: string): string | null {
  const m = WAKE.exec(text);
  return m ? text.slice(m.index + m[0].length).replace(/^[\s,.:;!?-]+/, "").trim() : null;
}

/** Text for the speaker: no links, markdown or emoji. */
export function speakable(text: string): string {
  return text.replace(/\/s\/[a-z0-9-]+/g, "").replace(/[*_`#>]/g, "").replace(/[\p{Extended_Pictographic}\uFE0F]/gu, "").replace(/\s+/g, " ").trim();
}

function recognitionCtor(): RecognitionCtor | null {
  if (typeof window === "undefined") return null;
  const w = window as unknown as { SpeechRecognition?: RecognitionCtor; webkitSpeechRecognition?: RecognitionCtor };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null;
}

function pickVoice(): SpeechSynthesisVoice | undefined {
  const voices = window.speechSynthesis.getVoices();
  return ["sr", "hr", "bs"].map((p) => voices.find((v) => v.lang.toLowerCase().startsWith(p))).find(Boolean);
}

interface Options {
  /** A finished sentence the person said (a question, or what came after the wake word). */
  onSpeech: (text: string) => void;
  /** Called once when the wake word is heard. */
  onWake: () => void;
  /** Keep listening for the wake word "Todore". */
  wake: boolean;
}

export function useSpeech({ onSpeech, onWake, wake }: Options) {
  const [supported, setSupported] = useState(false);
  const [ios, setIos] = useState(false);
  const [listening, setListening] = useState(false);
  const [speaking, setSpeaking] = useState(false);
  const [interim, setInterim] = useState("");
  const [error, setError] = useState<string | null>(null);
  const recRef = useRef<Recognition | null>(null);
  const modeRef = useRef<"off" | "once" | "wake">("off");
  const awakeRef = useRef(false);
  const langRef = useRef(PRIMARY_LANG);
  const speakingRef = useRef(false);
  const cb = useRef({ onSpeech, onWake });
  cb.current = { onSpeech, onWake };
  const wakeRef = useRef(wake);
  wakeRef.current = wake;

  useEffect(() => {
    setSupported(recognitionCtor() !== null);
    // Safari on iPhone can't keep a microphone open in the background, so the wake word is not offered there.
    setIos(/iPhone|iPad|iPod/.test(navigator.userAgent));
  }, []);

  const halt = useCallback((): void => {
    modeRef.current = "off";
    recRef.current?.abort();
    recRef.current = null;
    setListening(false);
    setInterim("");
  }, []);

  const begin = useCallback((mode: "once" | "wake"): void => {
    const Ctor = recognitionCtor();
    if (!Ctor) return;
    recRef.current?.abort();
    modeRef.current = mode;
    awakeRef.current = false;
    const rec = new Ctor();
    recRef.current = rec;
    // A one-question listening is over: back to waiting for the wake word, if that is switched on.
    const finishOnce = (): void => {
      halt();
      if (wakeRef.current) begin("wake");
    };
    rec.lang = langRef.current;
    rec.continuous = mode === "wake";
    rec.interimResults = true;
    rec.onresult = (e) => {
      let live = "";
      for (let i = e.resultIndex; i < e.results.length; i++) {
        const r = e.results[i];
        const text = r[0].transcript.trim();
        if (!r.isFinal) {
          live = text;
          continue;
        }
        if (!text) continue;
        if (mode === "once") {
          cb.current.onSpeech(text);
          finishOnce();
          return;
        }
        // Wake mode: nothing is used (or sent anywhere) until "Todore" is heard.
        if (awakeRef.current) {
          awakeRef.current = false;
          cb.current.onSpeech(text);
          continue;
        }
        const rest = afterWakeWord(text);
        if (rest === null) continue;
        cb.current.onWake();
        if (rest) cb.current.onSpeech(rest);
        else awakeRef.current = true;
      }
      setInterim(mode === "once" || awakeRef.current ? live : "");
    };
    rec.onerror = (e) => {
      if (e.error === "language-not-supported" && langRef.current === PRIMARY_LANG) {
        langRef.current = FALLBACK_LANG;
        return;
      }
      if (e.error === "not-allowed" || e.error === "service-not-allowed") {
        setError("Mikrofon nije dozvoljen. Dozvolite ga u podešavanjima pregledača.");
        halt();
      }
    };
    rec.onend = () => {
      // Browsers end a recognition after a pause; in wake mode it simply starts again (not while Todor is talking).
      if (recRef.current === rec && modeRef.current === "wake" && !speakingRef.current) {
        window.setTimeout(() => recRef.current === rec && modeRef.current === "wake" && begin("wake"), 300);
      } else if (recRef.current === rec && modeRef.current === "once" && langRef.current === FALLBACK_LANG && rec.lang === PRIMARY_LANG) {
        begin("once");
      } else if (recRef.current === rec && modeRef.current === "once") {
        finishOnce();
      }
    };
    setError(null);
    setListening(true);
    try {
      rec.start();
    } catch {
      halt();
    }
  }, [halt]);

  // Wake-word listening follows the switch; leaving the page stops the microphone.
  useEffect(() => {
    if (wake && supported) begin("wake");
    else if (modeRef.current === "wake") halt();
    return () => {
      if (modeRef.current === "wake") halt();
    };
  }, [wake, supported, begin, halt]);

  const speak = useCallback(
    (text: string): void => {
      const clean = speakable(text);
      if (!clean || typeof window === "undefined" || !("speechSynthesis" in window)) return;
      const synth = window.speechSynthesis;
      synth.cancel();
      const utterance = new SpeechSynthesisUtterance(clean);
      const voice = pickVoice();
      utterance.lang = voice?.lang ?? PRIMARY_LANG;
      if (voice) utterance.voice = voice;
      utterance.onstart = () => {
        speakingRef.current = true;
        setSpeaking(true);
        // The microphone must not hear Todor himself.
        if (modeRef.current === "wake") recRef.current?.abort();
      };
      utterance.onend = utterance.onerror = () => {
        speakingRef.current = false;
        setSpeaking(false);
        if (modeRef.current === "wake") begin("wake");
      };
      synth.speak(utterance);
    },
    [begin],
  );

  const stopSpeaking = useCallback((): void => {
    if (typeof window !== "undefined" && "speechSynthesis" in window) window.speechSynthesis.cancel();
  }, []);

  return {
    supported,
    ios,
    listening,
    speaking,
    interim,
    error,
    listenOnce: () => begin("once"),
    stopListening: halt,
    speak,
    stopSpeaking,
  };
}

"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, type FormEvent, type ReactNode } from "react";
import { useSpeech } from "./useSpeech";

interface ChatMessage {
  role: "user" | "assistant";
  content: string;
}

interface PendingAction {
  token: string;
  summary: string;
}

interface AssistantChatProps {
  slug?: string;
  salonName?: string;
  /** The salon owner's assistant in the admin panel. */
  admin?: boolean;
}

const SALON_SUGGESTIONS = ["Koliko košta šišanje?", "Ima li slobodno sutra?", "Kada radite subotom?"];
const ADMIN_SUGGESTIONS = ["Ko dolazi danas?", "Kolika je zarada ovog meseca?", "Ima li hitnih zahteva?"];
const WAKE_KEY = "todor-wake";
const HOME_SUGGESTIONS = ["Koji saloni postoje u Nišu?", "Kako se zakazuje termin?", "Da li stiže podsetnik?"];
const MAX_HISTORY = 12;

/** Turns /s/slug paths in an answer into links. */
function linkify(text: string): ReactNode[] {
  return text.split(/(\/s\/[a-z0-9-]+)/g).map((part, i) =>
    /^\/s\/[a-z0-9-]+$/.test(part) ? (
      <Link key={i} href={part} className="underline underline-offset-2 hover:text-burgundy">
        {part}
      </Link>
    ) : (
      part
    ),
  );
}

export function AssistantChat({ slug, salonName, admin }: AssistantChatProps) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pendingAction, setPendingAction] = useState<PendingAction | null>(null);
  const [wake, setWake] = useState(false);
  const readAloud = useRef(false);
  const listRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    listRef.current?.scrollTo({ top: listRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, pending]);

  // Opening the chat moves the keyboard into the question field.
  useEffect(() => {
    if (open) inputRef.current?.focus();
  }, [open]);

  const speech = useSpeech({
    wake,
    onWake: () => setOpen(true),
    onSpeech: (text) => void ask(text, true),
  });

  useEffect(() => {
    try {
      setWake(localStorage.getItem(WAKE_KEY) === "1");
    } catch {
      // Storage can be blocked; the switch then starts off.
    }
  }, []);

  function toggleWake(): void {
    const next = !wake;
    setWake(next);
    try {
      localStorage.setItem(WAKE_KEY, next ? "1" : "0");
    } catch {
      // Not remembered, still works for this visit.
    }
  }

  /** Shows (and, after a spoken question, reads out) what Todor answered. */
  function say(text: string, viaVoice: boolean): void {
    if (viaVoice) readAloud.current = true;
    if (readAloud.current) speech.speak(text);
  }

  async function ask(question: string, viaVoice = false): Promise<void> {
    const text = question.trim();
    if (!text || pending) return;
    setOpen(true);
    setPendingAction(null);
    speech.stopSpeaking();
    if (!viaVoice) readAloud.current = false;
    const next: ChatMessage[] = [...messages, { role: "user" as const, content: text }].slice(-MAX_HISTORY);
    // The API wants the history to start with a question.
    while (next.length > 0 && next[0].role !== "user") next.shift();
    setMessages(next);
    setInput("");
    setError(null);
    setPending(true);
    try {
      const res = await fetch("/api/assistant", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ slug, admin, messages: next }),
      });
      const data = (await res.json()) as { reply?: string; error?: string; pending?: PendingAction };
      if (!res.ok || !data.reply) {
        setError(data.error ?? "Asistent trenutno ne radi.");
        return;
      }
      setMessages([...next, { role: "assistant", content: data.reply }]);
      setPendingAction(data.pending ?? null);
      say(data.pending ? `${data.reply} Potvrdite na ekranu.` : data.reply, viaVoice);
    } catch {
      setError("Nema veze sa serverom. Pokušajte ponovo.");
    } finally {
      setPending(false);
    }
  }

  /** The person pressed "Potvrdi": the server runs the action Todor prepared. */
  async function confirm(): Promise<void> {
    if (!pendingAction || !slug || pending) return;
    setPending(true);
    setError(null);
    try {
      const res = await fetch("/api/assistant/confirm", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token: pendingAction.token, slug, admin }),
      });
      const data = (await res.json()) as { message?: string; error?: string };
      const text = res.ok ? (data.message ?? "Gotovo.") : (data.error ?? "Radnja nije uspela.");
      setMessages((m) => [...m, { role: "assistant", content: text }]);
      setPendingAction(null);
      say(text, false);
      if (res.ok) router.refresh();
    } catch {
      setError("Nema veze sa serverom. Pokušajte ponovo.");
    } finally {
      setPending(false);
    }
  }

  function onSubmit(event: FormEvent<HTMLFormElement>): void {
    event.preventDefault();
    void ask(input);
  }

  const suggestions = admin ? ADMIN_SUGGESTIONS : slug ? SALON_SUGGESTIONS : HOME_SUGGESTIONS;

  return (
    <div className={`fixed right-4 z-50 flex flex-col items-end gap-3 sm:right-6 sm:bottom-6 ${
        // Salon pages have a sticky booking bar on phones; sit above it.
        slug && !admin ? "bottom-[calc(5rem+env(safe-area-inset-bottom))] md:bottom-6" : "bottom-4"
      }`}>
      {open && (
        <section
          aria-label="Todor, AI asistent"
          onKeyDown={(e) => {
            if (e.key === "Escape") setOpen(false);
          }}
          className="animate-rise flex h-[min(32rem,70dvh)] w-[calc(100vw-2rem)] max-w-sm flex-col overflow-hidden rounded-3xl border border-line bg-white shadow-[0_24px_60px_-20px_rgb(0_0_0/0.3)]"
        >
          <header className="flex items-start justify-between border-b border-line bg-cream px-5 py-4">
            <div>
              <p className="eyebrow">AI asistent{salonName ? ` · ${salonName}` : ""}</p>
              <h2 className="font-serif text-2xl leading-tight">Todor</h2>
              {speech.supported && !speech.ios && (
                <label className="mt-1.5 flex cursor-pointer items-center gap-2 text-xs text-muted">
                  <input type="checkbox" checked={wake} onChange={toggleWake} />
                  Slušaj reč „Todore”
                </label>
              )}
            </div>
            <button
              type="button"
              onClick={() => setOpen(false)}
              aria-label="Zatvori asistenta"
              className="grid size-9 place-items-center rounded-full text-xl leading-none text-muted transition-colors hover:bg-sand hover:text-charcoal"
            >
              ×
            </button>
          </header>

          <div ref={listRef} className="flex-1 space-y-3 overflow-y-auto px-5 py-4 text-sm" aria-live="polite">
            {messages.length === 0 && (
              <div>
                <p className="text-muted">
                  {admin
                    ? "Pitajte me za raspored i zaradu, ili recite šta da uradim: upis, pomeranje, cene, radno vreme."
                    : slug
                    ? "Pitajte me za cene, radno vreme ili slobodne termine."
                    : "Pomoći ću vam da nađete salon i objasniću kako se zakazuje."}
                </p>
                <div className="mt-4 flex flex-wrap gap-2">
                  {suggestions.map((s) => (
                    <button
                      key={s}
                      type="button"
                      onClick={() => void ask(s)}
                      className="rounded-full border border-line px-3 py-1.5 text-left text-xs transition-all duration-200 ease-out hover:border-burgundy hover:text-burgundy"
                    >
                      {s}
                    </button>
                  ))}
                </div>
              </div>
            )}
            {messages.map((m, i) => (
              <p
                key={i}
                className={
                  m.role === "user"
                    ? "ml-8 whitespace-pre-wrap rounded-2xl rounded-br-md bg-burgundy px-3.5 py-2 text-white"
                    : "mr-8 whitespace-pre-wrap rounded-2xl rounded-bl-md bg-sand px-3.5 py-2"
                }
              >
                {m.role === "assistant" ? linkify(m.content) : m.content}
              </p>
            ))}
            {pending && <p className="mr-8 animate-pulse text-muted">Todor piše…</p>}
            {pendingAction && (
              <div className="rounded-2xl border border-burgundy/30 bg-cream p-3.5">
                <p className="font-medium">{pendingAction.summary}</p>
                <div className="mt-3 flex gap-2">
                  <button type="button" disabled={pending} onClick={() => void confirm()} className="btn-primary btn-sm">
                    Potvrdi
                  </button>
                  <button type="button" onClick={() => setPendingAction(null)} className="btn-secondary btn-sm">
                    Odustani
                  </button>
                </div>
              </div>
            )}
            {error && <p className="text-burgundy">{error}</p>}
          </div>

          {slug && !admin && (
            <a
              href="#zakazivanje"
              onClick={() => setOpen(false)}
              className="border-t border-line px-5 py-2.5 text-center text-sm font-medium text-burgundy hover:bg-cream"
            >
              Zakaži termin
            </a>
          )}
          <form onSubmit={onSubmit} className="flex gap-2 border-t border-line p-2">
            <label htmlFor="assistant-input" className="sr-only">
              Vaše pitanje
            </label>
            <input
              ref={inputRef}
              id="assistant-input"
              value={speech.listening && speech.interim ? speech.interim : input}
              onChange={(e) => setInput(e.target.value)}
              maxLength={1000}
              placeholder={speech.listening ? "Slušam…" : "Napišite ili izgovorite pitanje…"}
              className="min-w-0 flex-1 bg-transparent px-3 py-2 text-base outline-none placeholder:text-muted"
            />
            {speech.supported && (
              <button
                type="button"
                onClick={speech.listening ? speech.stopListening : speech.listenOnce}
                aria-pressed={speech.listening}
                aria-label={speech.listening ? "Prestani da slušaš" : "Govori"}
                className={`grid size-10 shrink-0 place-items-center rounded-full border text-lg transition-colors ${
                  speech.listening ? "animate-pulse border-burgundy bg-burgundy text-white" : "border-line hover:border-burgundy"
                }`}
              >
                <span aria-hidden>🎤</span>
              </button>
            )}
            <button
              type="submit"
              disabled={pending || !input.trim()}
              className="btn-primary btn-sm shrink-0"
            >
              Pošalji
            </button>
          </form>
          {speech.error && <p className="px-5 pb-1 text-xs text-burgundy">{speech.error}</p>}
          <p className="px-5 pb-2.5 text-xs text-muted">
            Odgovore daje AI i mogu sadržati greške. {admin ? "Svaku izmenu potvrđujete dugmetom." : "Termin potvrđuje salon."}
          </p>
        </section>
      )}
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className="btn bg-charcoal text-white shadow-[0_10px_30px_-10px_rgb(0_0_0/0.4)] hover:-translate-y-0.5 hover:bg-black"
      >
        <span aria-hidden>{open ? "×" : "✦"}</span>
        {open ? "Zatvori" : "Pitajte Todora"}
      </button>
      {!open && speech.supported && (
        <button
          type="button"
          onClick={() => {
            setOpen(true);
            speech.listenOnce();
          }}
          aria-label="Govori sa Todorom"
          className="btn bg-burgundy text-white shadow-[0_10px_30px_-10px_rgb(0_0_0/0.4)] hover:-translate-y-0.5"
        >
          <span aria-hidden>🎤</span>
          Govori
        </button>
      )}
    </div>
  );
}

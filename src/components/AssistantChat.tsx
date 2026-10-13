"use client";

import Link from "next/link";
import { useEffect, useRef, useState, type FormEvent, type ReactNode } from "react";

interface ChatMessage {
  role: "user" | "assistant";
  content: string;
}

interface AssistantChatProps {
  slug?: string;
  salonName?: string;
}

const SALON_SUGGESTIONS = ["Koliko košta šišanje?", "Ima li slobodno sutra?", "Kada radite subotom?"];
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

export function AssistantChat({ slug, salonName }: AssistantChatProps) {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    listRef.current?.scrollTo({ top: listRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, pending]);

  // Opening the chat moves the keyboard into the question field.
  useEffect(() => {
    if (open) inputRef.current?.focus();
  }, [open]);

  async function ask(question: string): Promise<void> {
    const text = question.trim();
    if (!text || pending) return;
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
        body: JSON.stringify({ slug, messages: next }),
      });
      const data = (await res.json()) as { reply?: string; error?: string };
      if (!res.ok || !data.reply) {
        setError(data.error ?? "Asistent trenutno ne radi.");
        return;
      }
      setMessages([...next, { role: "assistant", content: data.reply }]);
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

  const suggestions = slug ? SALON_SUGGESTIONS : HOME_SUGGESTIONS;

  return (
    <div className={`fixed right-4 z-50 flex flex-col items-end gap-3 sm:right-6 sm:bottom-6 ${
        // Salon pages have a sticky booking bar on phones; sit above it.
        slug ? "bottom-[calc(5rem+env(safe-area-inset-bottom))] md:bottom-6" : "bottom-4"
      }`}>
      {open && (
        <section
          aria-label="AI asistent"
          onKeyDown={(e) => {
            if (e.key === "Escape") setOpen(false);
          }}
          className="animate-rise flex h-[min(32rem,70dvh)] w-[calc(100vw-2rem)] max-w-sm flex-col overflow-hidden rounded-3xl border border-line bg-white shadow-[0_24px_60px_-20px_rgb(0_0_0/0.3)]"
        >
          <header className="flex items-start justify-between border-b border-line bg-cream px-5 py-4">
            <div>
              <p className="eyebrow">AI asistent</p>
              <h2 className="font-serif text-2xl leading-tight">{salonName ?? "mojfrizer"}</h2>
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
                  {slug
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
            {pending && <p className="mr-8 animate-pulse text-muted">Asistent piše…</p>}
            {error && <p className="text-burgundy">{error}</p>}
          </div>

          {slug && (
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
              value={input}
              onChange={(e) => setInput(e.target.value)}
              maxLength={1000}
              placeholder="Napišite pitanje…"
              className="min-w-0 flex-1 bg-transparent px-3 py-2 text-base outline-none placeholder:text-muted"
            />
            <button
              type="submit"
              disabled={pending || !input.trim()}
              className="btn-primary btn-sm shrink-0"
            >
              Pošalji
            </button>
          </form>
          <p className="px-5 pb-2.5 text-xs text-muted">Odgovore daje AI i mogu sadržati greške. Termin potvrđuje salon.</p>
        </section>
      )}
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className="btn bg-charcoal text-white shadow-[0_10px_30px_-10px_rgb(0_0_0/0.4)] hover:-translate-y-0.5 hover:bg-black"
      >
        <span aria-hidden>{open ? "×" : "✦"}</span>
        {open ? "Zatvori" : "Pitajte asistenta"}
      </button>
    </div>
  );
}

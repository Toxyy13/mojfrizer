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

  useEffect(() => {
    listRef.current?.scrollTo({ top: listRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, pending]);

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
    <div className="fixed bottom-4 right-4 z-50 flex flex-col items-end gap-3 sm:bottom-6 sm:right-6">
      {open && (
        <section
          aria-label="AI asistent"
          className="flex h-[min(32rem,75vh)] w-[calc(100vw-2rem)] max-w-sm flex-col border border-neutral-200 bg-white"
        >
          <header className="flex items-start justify-between border-b border-neutral-200 bg-cream px-5 py-4">
            <div>
              <p className="text-[10px] uppercase tracking-[0.25em] text-neutral-500">AI asistent</p>
              <h2 className="font-serif text-2xl leading-tight">{salonName ?? "mojfrizer"}</h2>
            </div>
            <button
              type="button"
              onClick={() => setOpen(false)}
              aria-label="Zatvori asistenta"
              className="text-xl leading-none text-neutral-500 transition-colors hover:text-burgundy"
            >
              ×
            </button>
          </header>

          <div ref={listRef} className="flex-1 space-y-3 overflow-y-auto px-5 py-4 text-sm" aria-live="polite">
            {messages.length === 0 && (
              <div>
                <p className="text-neutral-600">
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
                      className="border border-neutral-200 px-3 py-1.5 text-left text-xs transition-all duration-300 ease-out hover:-translate-y-0.5 hover:border-burgundy hover:text-burgundy"
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
                    ? "ml-8 whitespace-pre-wrap bg-charcoal px-3 py-2 text-white"
                    : "mr-8 whitespace-pre-wrap border border-neutral-200 bg-cream px-3 py-2"
                }
              >
                {m.role === "assistant" ? linkify(m.content) : m.content}
              </p>
            ))}
            {pending && <p className="mr-8 animate-pulse text-neutral-500">Asistent piše…</p>}
            {error && <p className="text-burgundy">{error}</p>}
          </div>

          {slug && (
            <a
              href="#zakazivanje"
              onClick={() => setOpen(false)}
              className="border-t border-neutral-200 px-5 py-2 text-center text-xs uppercase tracking-[0.2em] text-burgundy hover:bg-cream"
            >
              Zakaži termin
            </a>
          )}
          <form onSubmit={onSubmit} className="flex gap-2 border-t border-neutral-200 px-3 py-3">
            <label htmlFor="assistant-input" className="sr-only">
              Vaše pitanje
            </label>
            <input
              id="assistant-input"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              maxLength={1000}
              placeholder="Napišite pitanje…"
              className="min-w-0 flex-1 bg-transparent px-2 py-2 text-sm outline-none placeholder:text-neutral-400"
            />
            <button
              type="submit"
              disabled={pending || !input.trim()}
              className="bg-burgundy px-4 text-xs uppercase tracking-[0.15em] text-white transition-colors hover:bg-burgundy-dark disabled:opacity-40"
            >
              Pošalji
            </button>
          </form>
          <p className="px-5 pb-2 text-[10px] text-neutral-400">Odgovore daje AI i mogu sadržati greške. Termin potvrđuje salon.</p>
        </section>
      )}
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className="bg-burgundy px-5 py-3 text-xs uppercase tracking-[0.2em] text-white transition-all duration-300 ease-out hover:-translate-y-0.5 hover:bg-burgundy-dark"
      >
        {open ? "Zatvori" : "Pitajte asistenta"}
      </button>
    </div>
  );
}

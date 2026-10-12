import { MAX_MESSAGE_LENGTH, type ChatLine } from "@/lib/chat";
import { TIME_ZONE } from "@/lib/time";
import { ChatRefresh } from "./ChatRefresh";

interface ChatThreadProps {
  messages: ChatLine[];
  /** True when the viewer is the salon side: salon messages are shown on the right. */
  viewerIsSalon: boolean;
  send: (formData: FormData) => Promise<void>;
  emptyHint: string;
}

const timeFormat = new Intl.DateTimeFormat("sr-Latn-RS", {
  timeZone: TIME_ZONE,
  day: "numeric",
  month: "numeric",
  hour: "2-digit",
  minute: "2-digit",
});

/** Shared conversation view for the customer page and the salon admin. */
export function ChatThread({ messages, viewerIsSalon, send, emptyHint }: ChatThreadProps) {
  return (
    <div>
      <ChatRefresh />
      <ol className="grid gap-4 border-y border-neutral-200 py-8" aria-live="polite">
        {messages.length === 0 && <li className="text-neutral-500">{emptyHint}</li>}
        {messages.map((m) => {
          const mine = m.fromSalon === viewerIsSalon;
          return (
            <li key={m.id} className={`flex flex-col ${mine ? "items-end" : "items-start"}`}>
              <p
                className={`max-w-[85%] whitespace-pre-wrap break-words px-4 py-3 ${
                  mine ? "bg-burgundy text-white" : "border border-neutral-300"
                }`}
              >
                {m.text}
              </p>
              <span className="mt-1 text-xs text-neutral-500">{timeFormat.format(m.createdAt)}</span>
            </li>
          );
        })}
      </ol>
      <form action={send} className="mt-6 flex items-end gap-4">
        <label className="flex-1">
          <span className="sr-only">Poruka</span>
          <textarea
            name="text"
            required
            rows={2}
            maxLength={MAX_MESSAGE_LENGTH}
            placeholder="Napišite poruku…"
            className="w-full resize-none border-b border-neutral-300 bg-transparent py-2 text-lg outline-none transition-colors focus:border-burgundy"
          />
        </label>
        <button className="bg-burgundy px-8 py-3 text-sm uppercase tracking-[0.2em] text-white transition-all duration-300 ease-out hover:-translate-y-0.5 hover:bg-burgundy-dark">
          Pošalji
        </button>
      </form>
    </div>
  );
}

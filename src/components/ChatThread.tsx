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
      <ol className="grid min-h-64 content-end gap-3 rounded-xl border border-line bg-white p-4 sm:p-6" aria-live="polite">
        {messages.length === 0 && <li className="self-center py-10 text-center text-sm text-muted">{emptyHint}</li>}
        {messages.map((m) => {
          const mine = m.fromSalon === viewerIsSalon;
          return (
            <li key={m.id} className={`flex flex-col ${mine ? "items-end" : "items-start"}`}>
              <p
                className={`max-w-[85%] whitespace-pre-wrap break-words rounded-xl px-4 py-2.5 text-[15px] leading-relaxed ${
                  mine ? "rounded-br-md bg-burgundy text-white" : "rounded-bl-md bg-sand"
                }`}
              >
                {m.text}
              </p>
              <span className="mt-1 px-1 text-[11px] text-muted">{timeFormat.format(m.createdAt)}</span>
            </li>
          );
        })}
      </ol>
      <form action={send} className="sticky bottom-3 mt-4 flex items-end gap-2 rounded-xl border border-line bg-white p-2 shadow-[0_8px_30px_-12px_rgb(0_0_0/0.15)]">
        <label className="flex-1">
          <span className="sr-only">Poruka</span>
          <textarea
            name="text"
            required
            rows={1}
            maxLength={MAX_MESSAGE_LENGTH}
            placeholder="Napišite poruku…"
            className="block max-h-40 w-full resize-none bg-transparent px-3 py-2.5 text-base outline-none placeholder:text-muted"
          />
        </label>
        <button className="btn-primary shrink-0 px-5">
          Pošalji
        </button>
      </form>
    </div>
  );
}

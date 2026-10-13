// Sends email through Resend's HTTP API. Without RESEND_API_KEY (local dev) the message is only logged.

export interface MailMessage {
  to: string;
  subject: string;
  text: string;
  /** Optional mail only: adds an unsubscribe line and the List-Unsubscribe headers. */
  unsubscribe?: { pageUrl: string; postUrl: string };
}

/** Throws when the provider rejects the message, so callers can retry later. */
export async function sendMail(message: MailMessage): Promise<void> {
  const text = message.unsubscribe
    ? `${message.text}\n\n--\nViše ne želite ove mejlove? Odjavite se jednim klikom: ${message.unsubscribe.pageUrl}`
    : message.text;
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    console.log(`[mail:dev] to=${message.to} subject=${message.subject}\n${text}`);
    return;
  }
  const from = process.env.MAIL_FROM;
  if (!from) throw new Error("MAIL_FROM must be set when RESEND_API_KEY is set");
  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      from,
      to: [message.to],
      subject: message.subject,
      text,
      ...(message.unsubscribe
        ? {
            headers: {
              "List-Unsubscribe": `<${message.unsubscribe.postUrl}>`,
              "List-Unsubscribe-Post": "List-Unsubscribe=One-Click",
            },
          }
        : {}),
    }),
  });
  if (!response.ok) throw new Error(`Mail provider answered ${response.status}: ${await response.text()}`);
}

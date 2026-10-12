// Sends email through Resend's HTTP API. Without RESEND_API_KEY (local dev) the message is only logged.

export interface MailMessage {
  to: string;
  subject: string;
  text: string;
}

/** Throws when the provider rejects the message, so callers can retry later. */
export async function sendMail(message: MailMessage): Promise<void> {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    console.log(`[mail:dev] to=${message.to} subject=${message.subject}\n${message.text}`);
    return;
  }
  const from = process.env.MAIL_FROM;
  if (!from) throw new Error("MAIL_FROM must be set when RESEND_API_KEY is set");
  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({ from, to: [message.to], subject: message.subject, text: message.text }),
  });
  if (!response.ok) throw new Error(`Mail provider answered ${response.status}: ${await response.text()}`);
}

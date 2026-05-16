export type BrevoRecipient = { email: string; name?: string };

export type SendBrevoEmailParams = {
  to: BrevoRecipient[];
  subject: string;
  htmlContent: string;
  textContent?: string;
};

export function isBrevoConfigured(): boolean {
  return Boolean(process.env.BREVO_API_KEY?.trim() && process.env.BREVO_SENDER_EMAIL?.trim());
}

function stripHtml(html: string): string {
  return html
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/p>/gi, "\n\n")
    .replace(/<[^>]+>/g, "")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

export async function sendBrevoEmail(params: SendBrevoEmailParams): Promise<{ messageId?: string }> {
  const apiKey = process.env.BREVO_API_KEY?.trim();
  const senderEmail = process.env.BREVO_SENDER_EMAIL?.trim();
  const senderName =
    process.env.BREVO_SENDER_NAME?.trim() || "École Ducasse — Service Stages & Carrières";

  if (!apiKey || !senderEmail) {
    throw new Error(
      "Configuration Brevo incomplète : définissez BREVO_API_KEY et BREVO_SENDER_EMAIL dans backend/.env",
    );
  }

  const res = await fetch("https://api.brevo.com/v3/smtp/email", {
    method: "POST",
    headers: {
      "api-key": apiKey,
      "Content-Type": "application/json",
      Accept: "application/json",
    },
    body: JSON.stringify({
      sender: { name: senderName, email: senderEmail },
      to: params.to.map((r) => ({
        email: r.email.trim(),
        name: r.name?.trim() || undefined,
      })),
      subject: params.subject,
      htmlContent: params.htmlContent,
      textContent: params.textContent ?? stripHtml(params.htmlContent),
    }),
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Brevo (${res.status}) : ${body.slice(0, 500)}`);
  }

  return (await res.json()) as { messageId?: string };
}

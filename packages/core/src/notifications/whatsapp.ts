export interface WhatsAppMessage {
  to: string;
  body: string;
  templateName?: string;
  languageCode?: string;
}

export class WhatsAppSender {
  private apiKey: string;
  private phoneNumberId: string;
  private baseUrl: string;

  constructor(apiKey: string, phoneNumberId: string, baseUrl = "https://graph.facebook.com/v18.0") {
    this.apiKey = apiKey;
    this.phoneNumberId = phoneNumberId;
    this.baseUrl = baseUrl;
  }

  async sendText(message: WhatsAppMessage): Promise<{ messageId: string }> {
    const url = `${this.baseUrl}/${this.phoneNumberId}/messages`;
    const res = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${this.apiKey}`,
      },
      body: JSON.stringify({
        messaging_product: "whatsapp",
        recipient_type: "individual",
        to: message.to,
        type: "text",
        text: { body: message.body },
      }),
    });

    if (!res.ok) {
      const body = await res.text();
      throw new Error(`WhatsApp API error ${res.status}: ${body}`);
    }

    const data = await res.json();
    return { messageId: data.messages?.[0]?.id ?? "" };
  }

  async sendTemplate(message: WhatsAppMessage): Promise<{ messageId: string }> {
    const url = `${this.baseUrl}/${this.phoneNumberId}/messages`;
    const res = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${this.apiKey}`,
      },
      body: JSON.stringify({
        messaging_product: "whatsapp",
        recipient_type: "individual",
        to: message.to,
        type: "template",
        template: {
          name: message.templateName ?? "jobblitz_notification",
          language: { code: message.languageCode ?? "en" },
        },
      }),
    });

    if (!res.ok) {
      const body = await res.text();
      throw new Error(`WhatsApp API error ${res.status}: ${body}`);
    }

    const data = await res.json();
    return { messageId: data.messages?.[0]?.id ?? "" };
  }
}

export function createWhatsAppSender(): WhatsAppSender | null {
  const apiKey = process.env.WHATSAPP_API_KEY;
  const phoneNumberId = process.env.WHATSAPP_PHONE_NUMBER_ID;
  if (!apiKey || !phoneNumberId) {
    console.warn("[WhatsApp] WHATSAPP_API_KEY or WHATSAPP_PHONE_NUMBER_ID not set");
    return null;
  }
  return new WhatsAppSender(apiKey, phoneNumberId);
}

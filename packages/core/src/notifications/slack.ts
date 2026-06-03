export interface SlackMessage {
  text: string;
  channel?: string;
  username?: string;
  iconEmoji?: string;
}

export class SlackWebhook {
  private url: string;

  constructor(url: string) {
    this.url = url;
  }

  async send(message: SlackMessage): Promise<void> {
    const res = await fetch(this.url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        text: message.text,
        channel: message.channel,
        username: message.username ?? "JobBlitz CoachBot",
        icon_emoji: message.iconEmoji ?? ":robot_face:",
      }),
    });

    if (!res.ok) {
      const body = await res.text();
      throw new Error(`Slack webhook error ${res.status}: ${body}`);
    }
  }
}

export function createSlackWebhook(): SlackWebhook | null {
  const url = process.env.COACH_SLACK_WEBHOOK_URL;
  if (!url) {
    console.warn("[Slack] COACH_SLACK_WEBHOOK_URL not set");
    return null;
  }
  return new SlackWebhook(url);
}

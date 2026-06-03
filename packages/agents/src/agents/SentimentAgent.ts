import { BaseAgent } from "../BaseAgent";
import type { SentimentResult } from "../state";

const POSITIVE_WORDS = new Set([
  "happy", "great", "good", "love", "excellent", "awesome", "thanks", "grateful",
  "excited", "pleased", "satisfied", "helpful", "amazing", "perfect", "best",
]);

const NEGATIVE_WORDS = new Set([
  "bad", "terrible", "worst", "hate", "angry", "frustrated", "disappointed",
  "annoyed", "upset", "sad", "worried", "stressed", "confused", "useless",
  "waste", "scam", "fraud", "cheat", "quit", "cancel", "refund",
]);

const URGENT_WORDS = new Set([
  "urgent", "asap", "immediately", "now", "today", "deadline", "emergency",
  "critical", "hurry", "rush", "lost", "stuck", "blocked",
]);

export class SentimentAgent extends BaseAgent<string, SentimentResult> {
  readonly name = "SentimentAgent";
  readonly model = "keyword-heuristic";

  protected run(text: string): Promise<SentimentResult> {
    const words = text.toLowerCase().split(/\W+/).filter(Boolean);
    let positive = 0;
    let negative = 0;
    let urgent = 0;

    for (const w of words) {
      if (POSITIVE_WORDS.has(w)) positive++;
      if (NEGATIVE_WORDS.has(w)) negative++;
      if (URGENT_WORDS.has(w)) urgent++;
    }

    const sentiment = negative > positive ? "negative" : positive > negative ? "positive" : "neutral";
    const urgency = Math.min(10, urgent * 2);
    const churnRisk = Math.min(100, negative * 10 + urgent * 5);
    const humanHandoffNeeded = churnRisk > 80 || urgency > 8;

    const intent = urgent > 0 ? "urgent_request" : negative > positive ? "complaint" : "general";

    const replyStrategy = humanHandoffNeeded
      ? "Escalate to human coach immediately"
      : sentiment === "negative"
        ? "Acknowledge frustration and offer concrete next steps"
        : sentiment === "positive"
          ? "Reinforce momentum and suggest next action"
          : "Provide factual guidance";

    return Promise.resolve({
      sentiment,
      intent,
      urgency,
      humanHandoffNeeded,
      churnRisk,
      replyStrategy,
    });
  }

  protected fallbackResult(_text: string): SentimentResult {
    return {
      sentiment: "neutral",
      intent: "unknown",
      urgency: 5,
      humanHandoffNeeded: true,
      churnRisk: 50,
      replyStrategy: "Service error — default to human handoff",
    };
  }
}

export const sentimentAgent = new SentimentAgent();

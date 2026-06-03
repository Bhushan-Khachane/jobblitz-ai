import { BaseAgent } from "../BaseAgent";
import type { RedFlagResult } from "../state";

const RED_FLAG_PATTERNS = [
  { pattern: /\b(network\s+marketing|mlm|multi.level|chain\s+referral|direct\s+selling)\b/gi, flag: "Possible MLM / pyramid scheme" },
  { pattern: /\b(pay\s+(?:rs\.?|₹|inr)?\s*\d+|upfront\s+fee|registration\s+fee)\b/gi, flag: "Upfront payment requested" },
  { pattern: /\b(earn\s+\d+\s*(lpa|lac|lakh|crore)\s+(?:daily|weekly)|unlimited\s+income)\b/gi, flag: "Unrealistic earnings claim" },
  { pattern: /\b(vague\s+description|details\s+will\s+be\s+shared\s+later)\b/gi, flag: "Vague job description" },
  { pattern: /\b(work\s+from\s+home\s+guarantee|no\s+experience\s+needed\s+high\s+pay)\b/gi, flag: "Too-good-to-be-true offer" },
];

export class RedFlagAgent extends BaseAgent<string, RedFlagResult> {
  readonly name = "RedFlagAgent";
  readonly model = "keyword-heuristic";

  protected run(text: string): Promise<RedFlagResult> {
    const flags: string[] = [];
    for (const { pattern, flag } of RED_FLAG_PATTERNS) {
      if (pattern.test(text)) {
        flags.push(flag);
      }
    }

    let overallRisk: RedFlagResult["overallRisk"] = "SAFE";
    if (flags.length >= 2) overallRisk = "HIGH";
    else if (flags.length === 1) overallRisk = "CAUTION";

    return Promise.resolve({
      overallRisk,
      flags,
      askCoach: overallRisk === "HIGH",
    });
  }

  protected fallbackResult(_text: string): RedFlagResult {
    return {
      overallRisk: "CAUTION",
      flags: ["Service error — manual review recommended"],
      askCoach: true,
    };
  }
}

export const redFlagAgent = new RedFlagAgent();

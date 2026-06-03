export interface ComplianceCheckResult {
  blocked: boolean;
  violations: string[];
  modifiedText?: string | undefined;
}

export interface ComplianceRule {
  id: string;
  pattern: RegExp;
  message: string;
  severity: "block" | "warn";
}

const DEFAULT_RULES: ComplianceRule[] = [
  {
    id: "GUARANTEE",
    pattern: /\b(guarantee|guaranteed|100% placement|assured job|sure shot)\b/gi,
    message: "Contains guarantee of placement",
    severity: "block",
  },
  {
    id: "UPFRONT_PAYMENT",
    pattern: /\b(pay\s+(?:rs\.?|₹|inr)?\s*\d+|upfront\s+fee|registration\s+fee|pay\s+to\s+apply)\b/gi,
    message: "Requests upfront payment",
    severity: "block",
  },
  {
    id: "MISLEADING_SALARY",
    pattern: /\b(earn\s+\d+\s*(lpa|lac|lakh|crore)\s+(?:daily|weekly)|unlimited\s+income)\b/gi,
    message: "Misleading salary claims",
    severity: "block",
  },
  {
    id: "DISCRIMINATION",
    pattern: /\b(male\s+(?:only|candidate)|female\s+(?:only|candidate)|age\s+\d+[-–]\d+|marital\s+status)\b/gi,
    message: "Discriminatory language",
    severity: "block",
  },
  {
    id: "THIRD_PARTY_PHONE",
    pattern: /\b(call\s+(?:me|us)\s+at\s*\+?\d[\d\s-]{7,}|contact\s+\d[\d\s-]{7,})\b/gi,
    message: "Contains third-party phone number",
    severity: "warn",
  },
  {
    id: "MLM",
    pattern: /\b(network\s+marketing|mlm|multi.level|direct\s+selling|chain\s+referral)\b/gi,
    message: "Possible MLM/pyramid scheme language",
    severity: "block",
  },
];

export class ComplianceService {
  private rules: ComplianceRule[];

  constructor(rules?: ComplianceRule[]) {
    this.rules = rules ?? DEFAULT_RULES;
  }

  check(text: string): ComplianceCheckResult {
    const violations: string[] = [];
    let blocked = false;
    let modifiedText = text;

    for (const rule of this.rules) {
      if (rule.pattern.test(text)) {
        violations.push(rule.message);
        if (rule.severity === "block") {
          blocked = true;
        }
        // Redact matched text in modified output
        modifiedText = modifiedText.replace(rule.pattern, "[REDACTED]");
      }
    }

    return {
      blocked,
      violations,
      modifiedText: violations.length > 0 ? modifiedText : undefined,
    };
  }

  addRule(rule: ComplianceRule): void {
    this.rules.push(rule);
  }
}

export function createComplianceService(rules?: ComplianceRule[]): ComplianceService {
  return new ComplianceService(rules);
}

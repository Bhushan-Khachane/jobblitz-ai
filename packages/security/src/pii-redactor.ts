// PII redaction patterns for logs
const LOG_PATTERNS = [
  { regex: /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/g, replacement: "[REDACTED-EMAIL]" },
  { regex: /\b(?:\+91[\s-]?)?[6-9]\d{9}\b/g, replacement: "[REDACTED-PHONE]" },
  { regex: /\b\d{4}[\s-]?\d{4}[\s-]?\d{4}\b/g, replacement: "[REDACTED-AADHAAR]" },
  { regex: /\b[A-Z]{5}\d{4}[A-Z]\b/g, replacement: "[REDACTED-PAN]" },
  { regex: /\b(?:password|passwd|pwd|token|api[_-]?key|secret|bearer)\s*[:=]\s*\S+/gi, replacement: "[REDACTED-CREDENTIAL]" },
];

// Stricter patterns for LLM contexts (also redact full names)
const LLM_PATTERNS = [
  ...LOG_PATTERNS,
  { regex: /\b(?:Mr\.?|Mrs\.?|Ms\.?|Dr\.?)\s+[A-Z][a-z]+(?:\s+[A-Z][a-z]+){1,2}\b/g, replacement: "[REDACTED-NAME]" },
  { regex: /\b[A-Z][a-z]+\s+[A-Z][a-z]+(?:\s+[A-Z][a-z]+)?\b/g, replacement: "[REDACTED-NAME]" },
];

function applyPatterns(text: string, patterns: Array<{ regex: RegExp; replacement: string }>): string {
  let redacted = text;
  for (const pattern of patterns) {
    redacted = redacted.replace(pattern.regex, pattern.replacement);
  }
  return redacted;
}

export function redactForLogs(text: string): string {
  return applyPatterns(text, LOG_PATTERNS);
}

export function redactForLLM(text: string): string {
  return applyPatterns(text, LLM_PATTERNS);
}

export function redactObject(obj: Record<string, unknown>, mode: "logs" | "llm" = "logs"): Record<string, unknown> {
  const result: Record<string, unknown> = {};
  const redactor = mode === "llm" ? redactForLLM : redactForLogs;

  for (const key of Object.keys(obj)) {
    const value = obj[key];
    if (typeof value === "string") {
      result[key] = redactor(value);
    } else if (typeof value === "object" && value !== null) {
      result[key] = redactObject(value as Record<string, unknown>, mode);
    } else {
      result[key] = value;
    }
  }
  return result;
}

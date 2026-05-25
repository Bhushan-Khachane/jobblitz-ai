const PII_PATTERNS = [
  { regex: /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/g, replacement: "[EMAIL]" },
  { regex: /\b\d{3}-\d{2}-\d{4}\b/g, replacement: "[SSN]" },
  { regex: /\b(?:\+91[\s-]?)?[6-9]\d{9}\b/g, replacement: "[PHONE]" },
  { regex: /\b\d{4}[\s-]?\d{4}[\s-]?\d{4}[\s-]?\d{4}\b/g, replacement: "[CARD]" },
  { regex: /\b(?:password|passwd|pwd)\s*[:=]\s*\S+/gi, replacement: "[PASSWORD]" },
];

export function redactPii(text: string): string {
  let redacted = text;
  for (const pattern of PII_PATTERNS) {
    redacted = redacted.replace(pattern.regex, pattern.replacement);
  }
  return redacted;
}

export function redactObject(obj: Record<string, unknown>): Record<string, unknown> {
  const result: Record<string, unknown> = {};
  for (const key of Object.keys(obj)) {
    const value = obj[key];
    if (typeof value === "string") {
      result[key] = redactPii(value);
    } else if (typeof value === "object" && value !== null) {
      result[key] = redactObject(value as Record<string, unknown>);
    } else {
      result[key] = value;
    }
  }
  return result;
}

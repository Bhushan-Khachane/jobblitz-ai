import { describe, it, expect } from "vitest";
import { redactForLogs, redactForLLM } from "../pii-redactor";

describe("pii-redactor", () => {
  it("redacts email in logs", () => {
    const text = "Contact me at alice@example.com for details.";
    expect(redactForLogs(text)).not.toContain("alice@example.com");
    expect(redactForLogs(text)).toContain("[REDACTED-EMAIL]");
  });

  it("redacts phone numbers", () => {
    const text = "Call +91-9876543210 or 9876543210";
    const result = redactForLogs(text);
    expect(result).not.toContain("9876543210");
    expect(result).toContain("[REDACTED-PHONE]");
  });

  it("redacts Aadhaar numbers", () => {
    const text = "Aadhaar: 1234 5678 9012";
    expect(redactForLogs(text)).toContain("[REDACTED-AADHAAR]");
  });

  it("redacts PAN numbers", () => {
    const text = "PAN: ABCDE1234F";
    expect(redactForLogs(text)).toContain("[REDACTED-PAN]");
  });

  it("redacts credentials in logs", () => {
    const text = "password: super-secret-123";
    expect(redactForLogs(text)).toContain("[REDACTED-CREDENTIAL]");
  });

  it("redacts names in LLM mode", () => {
    const text = "John Smith applied for the role.";
    const result = redactForLLM(text);
    expect(result).not.toContain("John Smith");
    expect(result).toContain("[REDACTED-NAME]");
  });
});

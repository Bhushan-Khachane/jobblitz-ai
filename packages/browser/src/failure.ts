export type FailureCategory =
  | "login_required"
  | "captcha"
  | "form_validation"
  | "page_not_found"
  | "rate_limited"
  | "timeout"
  | "selector_not_found"
  | "unknown";

export interface FailureAnalysis {
  category: FailureCategory;
  retryable: boolean;
  suggestion: string;
}

export function classifyError(error: Error | string, step: string): FailureAnalysis {
  const msg = (typeof error === "string" ? error : error.message).toLowerCase();

  if (msg.includes("captcha") || msg.includes("recaptcha") || msg.includes("hcaptcha")) {
    return { category: "captcha", retryable: false, suggestion: "Manual captcha solving required" };
  }

  if (msg.includes("login") || msg.includes("auth") || msg.includes("sign in")) {
    return { category: "login_required", retryable: true, suggestion: "Re-authenticate portal session" };
  }

  if (msg.includes("404") || msg.includes("not found") || msg.includes("expired")) {
    return { category: "page_not_found", retryable: false, suggestion: "Job posting may be removed" };
  }

  if (msg.includes("rate") || msg.includes("429") || msg.includes("too many")) {
    return { category: "rate_limited", retryable: true, suggestion: "Back off and retry with jitter" };
  }

  if (msg.includes("timeout") || msg.includes("timed out")) {
    return { category: "timeout", retryable: true, suggestion: "Increase timeout or retry" };
  }

  if (msg.includes("selector") || msg.includes("element") || msg.includes("locator")) {
    return { category: "selector_not_found", retryable: true, suggestion: "DOM changed, update selectors" };
  }

  if (msg.includes("validation") || msg.includes("required")) {
    return { category: "form_validation", retryable: true, suggestion: "Fill missing required fields" };
  }

  return { category: "unknown", retryable: false, suggestion: `Escalate: ${step} failed with ${msg.slice(0, 100)}` };
}

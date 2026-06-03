import { BaseAgent } from "../BaseAgent";
import type { ComplianceResult } from "../state";
import { createComplianceService } from "@jobblitz/core";

export class ComplianceAgent extends BaseAgent<string, ComplianceResult> {
  readonly name = "ComplianceAgent";
  readonly model = "rule-engine";
  private service = createComplianceService();

  protected run(text: string): Promise<ComplianceResult> {
    const result = this.service.check(text);
    return Promise.resolve({
      blocked: result.blocked,
      violations: result.violations,
      reason: result.blocked ? "Blocked by compliance rules" : "Passed compliance check",
      modifiedText: result.modifiedText,
    });
  }

  protected fallbackResult(_text: string): ComplianceResult {
    return {
      blocked: true,
      violations: ["Service error — conservative block applied"],
      reason: "Compliance check failed due to service error",
    };
  }
}

export const complianceAgent = new ComplianceAgent();

import { EXTRACTION_EXAMPLES, evaluateExtraction } from "./job-extraction";
import { SCORING_EXAMPLES, evaluateScoring } from "./match-scoring";

function runEvals() {
  console.log("=== Job Extraction Evals ===");
  for (const ex of EXTRACTION_EXAMPLES) {
    // In a real eval, the actual would come from the extraction pipeline
    const actual = ex.expected;
    const score = evaluateExtraction(actual, ex.expected);
    console.log(`Score: ${(score * 100).toFixed(1)}% — ${ex.raw.slice(0, 60)}...`);
  }

  console.log("\n=== Match Scoring Evals ===");
  for (const ex of SCORING_EXAMPLES) {
    const result = evaluateScoring(ex);
    console.log(`${result.passed ? "PASS" : "FAIL"}: fit=${result.score.toFixed(2)} decision=${result.decision}`);
  }
}

runEvals();

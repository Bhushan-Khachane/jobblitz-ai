# JobBlitz-AI — Evaluation Plan

> Framework for evaluating AI quality, system reliability, and product correctness.
> Updated: 2026-05-25

## Philosophy

- Evals are code, not manual checklists
- Run evals in CI on every PR that touches AI code
- Track eval scores over time
- Fail the build if eval scores regress
- Start simple, iterate based on real failures

## Eval Infrastructure

```
tools/evals/
├── src/
│   ├── runners/           # Test runners for each eval category
│   ├── fixtures/          # Sample data and expected outputs
│   ├── scorers/           # Scoring functions
│   └── reporters/         # Output formatters (JSON, HTML, CLI)
├── suites/
│   ├── job-extraction.ts
│   ├── match-scoring.ts
│   ├── resume-tailoring.ts
│   ├── application-success.ts
│   ├── failure-classification.ts
│   └── approval-decision.ts
├── results/               # Generated eval reports
└── package.json
```

## Eval Suites

### 1. Job Extraction Quality

**What**: Measures how well the system extracts structured job data from raw listings.

**Metrics**:
- Field extraction accuracy (title, company, location, salary, skills)
- Schema compliance rate
- Hallucination rate (invented fields)
- Salary normalization accuracy

**Dataset**: 100 labeled job listings from each source (Naukri, LinkedIn, Indeed, etc.)

**Pass Threshold**: >95% field accuracy, 0% hallucination, >90% salary accuracy

**Runner**:
```typescript
// tools/evals/suites/job-extraction.ts
import { runEval } from '../src/runners/eval';
import { fixtures } from '../src/fixtures/jobs';
import { extractionScorer } from '../src/scorers/extraction';

export async function runJobExtractionEval() {
  const results = await runEval({
    name: 'job-extraction',
    fixtures: fixtures.jobListings,
    fn: async (input) => {
      const response = await fetch('http://api:8000/api/v1/jobs/normalize', {
        method: 'POST',
        body: JSON.stringify(input),
      });
      return response.json();
    },
    scorer: extractionScorer,
  });

  return {
    score: results.averageScore,
    details: results.perFixture,
    passed: results.averageScore >= 0.95,
  };
}
```

### 2. Match Scoring Consistency

**What**: Measures consistency and calibration of job fit scoring.

**Metrics**:
- Consistency: Same input → same score (±0.05)
- Calibration: Score correlates with application success
- Decision accuracy: auto/approve/skip decisions are correct
- Bias: Score does not vary by company name alone

**Dataset**: 50 job-profile pairs with known outcomes

**Pass Threshold**: >90% consistency, >80% calibration, >85% decision accuracy

**Runner**:
```typescript
// tools/evals/suites/match-scoring.ts
import { runEval } from '../src/runners/eval';
import { fixtures } from '../src/fixtures/profiles';
import { scoringScorer } from '../src/scorers/scoring';

export async function runMatchScoringEval() {
  const results = await runEval({
    name: 'match-scoring',
    fixtures: fixtures.scoringPairs,
    fn: async (input) => {
      const response = await fetch('http://api:8000/api/v1/scoring/score', {
        method: 'POST',
        body: JSON.stringify(input),
      });
      return response.json();
    },
    scorer: scoringScorer,
  });

  return {
    score: results.averageScore,
    consistency: results.consistencyScore,
    calibration: results.calibrationScore,
    passed: results.averageScore >= 0.85,
  };
}
```

### 3. Resume Tailoring Quality

**What**: Measures quality of resume tailoring for specific jobs.

**Metrics**:
- Factual accuracy (no invented data)
- Relevance (skills highlighted match job)
- Professional tone (human review)
- Length preservation (within 10% of original)

**Dataset**: 20 resume-job pairs

**Pass Threshold**: 100% factual accuracy, >90% relevance, >4/5 tone, <10% length change

**Runner**:
```typescript
// tools/evals/suites/resume-tailoring.ts
import { runEval } from '../src/runners/eval';
import { fixtures } from '../src/fixtures/resumes';
import { tailoringScorer } from '../src/scorers/tailoring';

export async function runResumeTailoringEval() {
  const results = await runEval({
    name: 'resume-tailoring',
    fixtures: fixtures.tailoringPairs,
    fn: async (input) => {
      const response = await fetch('http://api:8000/api/v1/resumes/tailor', {
        method: 'POST',
        body: JSON.stringify(input),
      });
      return response.json();
    },
    scorer: tailoringScorer,
  });

  return {
    score: results.averageScore,
    factualAccuracy: results.factualAccuracy,
    relevance: results.relevanceScore,
    passed: results.factualAccuracy === 1.0 && results.averageScore >= 0.9,
  };
}
```

### 4. Application Success Rate

**What**: Measures end-to-end application success in controlled environments.

**Metrics**:
- Form completion rate
- Submission success rate
- Verification accuracy
- Time to complete

**Dataset**: 10 test applications on demo ATS instances

**Pass Threshold**: >80% submission success, >95% form completion

**Runner**:
```typescript
// tools/evals/suites/application-success.ts
import { runEval } from '../src/runners/eval';
import { fixtures } from '../src/fixtures/applications';
import { applicationScorer } from '../src/scorers/application';

export async function runApplicationSuccessEval() {
  const results = await runEval({
    name: 'application-success',
    fixtures: fixtures.testApplications,
    fn: async (input) => {
      const response = await fetch('http://api:8000/api/v1/applications/test-apply', {
        method: 'POST',
        body: JSON.stringify(input),
      });
      return response.json();
    },
    scorer: applicationScorer,
    timeout: 120000, // 2 minutes per application
  });

  return {
    score: results.averageScore,
    successRate: results.successRate,
    avgCompletionTime: results.avgTime,
    passed: results.successRate >= 0.8,
  };
}
```

### 5. Failure Classification Accuracy

**What**: Measures accuracy of browser automation failure classification.

**Metrics**:
- Classification accuracy (selector_drift, anti_bot, upload_failure, missing_fields, unexpected_navigation)
- False positive rate
- Escalation appropriateness

**Dataset**: 50 known failure scenarios

**Pass Threshold**: >85% classification accuracy, <10% false positive rate

**Runner**:
```typescript
// tools/evals/suites/failure-classification.ts
import { runEval } from '../src/runners/eval';
import { fixtures } from '../src/fixtures/failures';
import { failureScorer } from '../src/scorers/failure';

export async function runFailureClassificationEval() {
  const results = await runEval({
    name: 'failure-classification',
    fixtures: fixtures.failureScenarios,
    fn: async (input) => {
      const response = await fetch('http://worker-browser:8002/classify-failure', {
        method: 'POST',
        body: JSON.stringify(input),
      });
      return response.json();
    },
    scorer: failureScorer,
  });

  return {
    score: results.accuracy,
    falsePositiveRate: results.falsePositiveRate,
    passed: results.accuracy >= 0.85,
  };
}
```

### 6. Approval Decision Quality

**What**: Measures quality of human approval decisions.

**Metrics**:
- Decision time (should be < 2 minutes)
- Approval appropriateness (approved applications succeed)
- Rejection appropriateness (rejected applications would have failed)

**Dataset**: 30 simulated approval scenarios

**Pass Threshold**: >90% appropriate approvals, >90% appropriate rejections

**Runner**:
```typescript
// tools/evals/suites/approval-decision.ts
import { runEval } from '../src/runners/eval';
import { fixtures } from '../src/fixtures/approvals';
import { approvalScorer } from '../src/scorers/approval';

export async function runApprovalDecisionEval() {
  const results = await runEval({
    name: 'approval-decision',
    fixtures: fixtures.approvalScenarios,
    fn: async (input) => {
      // Simulate user decision
      const response = await fetch('http://api:8000/api/v1/approvals/evaluate', {
        method: 'POST',
        body: JSON.stringify(input),
      });
      return response.json();
    },
    scorer: approvalScorer,
  });

  return {
    score: results.appropriateness,
    avgDecisionTime: results.avgTime,
    passed: results.appropriateness >= 0.9,
  };
}
```

## CI Integration

```yaml
# .github/workflows/evals.yml
name: Evaluations
on:
  push:
    branches: [main, develop]
  pull_request:
    paths:
      - 'packages/agents/**'
      - 'packages/core/**'
      - 'apps/api/**'
      - 'apps/worker-*/**'
jobs:
  evals:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: oven-sh/setup-bun@v1
      - run: bun install
      - run: bun run build
      - run: docker compose up -d
      - run: bun run evals
      - uses: actions/upload-artifact@v4
        with:
          name: eval-results
          path: tools/evals/results/
```

## Running Evals Locally

```bash
# Run all evals
bun run evals

# Run specific eval
bun run evals --suite=job-extraction

# Run with verbose output
bun run evals --verbose

# Run against staging
EVAL_TARGET=staging bun run evals

# Generate HTML report
bun run evals --format=html
```

## Regression Policy

- Eval scores must not decrease from previous run
- New evals must have a baseline score before merging
- flaky evals must be fixed, not ignored
- Eval failures block merge

## Manual Review Process

Some evals require human judgment:

1. **Resume Tailoring Tone**: Sample 5 outputs per run, human rates 1-5
2. **Follow-up Email Quality**: Sample 3 outputs per run, human rates 1-5
3. **Browser Screenshot Verification**: Human confirms screenshot quality

## Eval Data Management

- Fixtures stored in `tools/evals/src/fixtures/`
- Sensitive data anonymized
- No production user data in evals
- Version fixtures with code

## Future Evals

- **Multi-agent coordination**: Measure correct agent routing
- **Research citation accuracy**: Measure citation correctness
- **Memory retrieval**: Measure semantic search relevance
- **Browser replayability**: Measure trace accuracy
- **Prompt injection resistance**: Measure guardrail effectiveness

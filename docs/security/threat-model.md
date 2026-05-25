# JobBlitz-AI Threat Model

> STRIDE analysis and security controls for the JobBlitz-AI platform.
> Updated: 2026-05-25

## Scope

This threat model covers:
- User authentication and authorization
- Job application automation (browser automation)
- Data storage (resumes, profiles, credentials)
- AI/LLM interactions
- Third-party integrations (job portals, LLM providers, Perplexity)
- Internal service communication
- Operational security

## Trust Boundaries

```
┌─────────────────────────────────────────────────────────────────┐
│                        External Zone                             │
│  ┌─────────┐  ┌─────────┐  ┌─────────┐  ┌─────────────────┐  │
│  │  User   │  │ Job     │  │  LLM    │  │  Object Storage │  │
│  │ Browser │  │ Portals │  │Providers│  │  (S3/R2)        │  │
│  └────┬────┘  └────┬────┘  └────┬────┘  └─────────────────┘  │
│       │            │            │                               │
└───────┼────────────┼────────────┼───────────────────────────────┘
        │            │            │
        ▼            ▼            ▼
┌─────────────────────────────────────────────────────────────────┐
│                        DMZ / Edge                                │
│  ┌─────────┐  ┌─────────┐  ┌─────────┐                        │
│  │   CDN   │  │  WAF    │  │ Load    │                        │
│  │(Cloudflare)│ │(Rules)  │  │Balancer │                        │
│  └────┬────┘  └────┬────┘  └────┬────┘                        │
└───────┼────────────┼────────────┼───────────────────────────────┘
        │            │            │
        ▼            ▼            ▼
┌─────────────────────────────────────────────────────────────────┐
│                        Application Zone                          │
│  ┌─────────┐  ┌─────────┐  ┌─────────┐  ┌─────────┐        │
│  │   Web   │  │   API   │  │ Worker  │  │ Worker  │        │
│  │(Next.js)│  │ (Hono)  │  │Orchestr.│  │ Browser │        │
│  └─────────┘  └────┬────┘  └────┬────┘  └────┬────┘        │
│                    │            │            │                 │
│  ┌─────────┐  ┌──┴────────────┴────────────┴──┐           │
│  │  MCP    │  │         Internal Services        │           │
│  │ Gateway │  │  Auth, Storage, Security, etc.  │           │
│  └─────────┘  └──────────────────────────────────┘           │
└─────────────────────────────────────────────────────────────────┘
        │
        ▼
┌─────────────────────────────────────────────────────────────────┐
│                        Data Zone                                 │
│  ┌─────────┐  ┌─────────┐  ┌─────────┐                        │
│  │PostgreSQL│  │  Redis  │  │ Secrets │                        │
│  │+ pgvector│  │ BullMQ  │  │ Manager │                        │
│  └─────────┘  └─────────┘  └─────────┘                        │
└─────────────────────────────────────────────────────────────────┘
```

## Assets

| Asset | Sensitivity | Owner | Notes |
|-------|-------------|-------|-------|
| User credentials (portal cookies) | Critical | User | Encrypted at rest |
| Resumes | High | User | May contain PII |
| Profile data | High | User | Skills, experience, salary |
| Job application history | Medium | User | Competitive intelligence |
| LLM prompts | Medium | System | May reveal system logic |
| API keys | Critical | System | LLM, storage, research |
| Audit logs | High | System | Immutable compliance record |
| Research artifacts | Medium | System | Company data |

## STRIDE Analysis

### Spoofing (Authentication)

| Threat | Risk | Mitigation | Status |
|--------|------|------------|--------|
| Attacker spoofs user identity | High | Better Auth with secure sessions, OAuth, MFA | Planned |
| Attacker spoofs service identity | High | mTLS between internal services, API key validation | Planned |
| Session hijacking | High | HTTP-only cookies, secure flag, SameSite=strict, session rotation | Planned |
| Credential stuffing | Medium | Rate limiting, account lockout, breach detection | Planned |
| JWT token replay | Medium | Short-lived access tokens, refresh token rotation | Planned |

### Tampering (Integrity)

| Threat | Risk | Mitigation | Status |
|--------|------|------------|--------|
| Resume tampering in transit | Medium | TLS 1.3 everywhere | Planned |
| Resume tampering at rest | Medium | S3 object versioning, integrity checks | Planned |
| Database tampering | High | Row-level security, audit logging, backups | Planned |
| API request tampering | Medium | Request signing, idempotency keys | Planned |
| Browser automation tampering | Medium | Screenshot verification, DOM diff, artifact storage | Planned |
| LLM prompt tampering | Low | Prompt versioning, checksums | Planned |

### Repudiation (Non-repudiation)

| Threat | Risk | Mitigation | Status |
|--------|------|------------|--------|
| User denies applying to job | High | Audit events table, screenshot proof, application step events | Existing |
| User denies approval | High | Approval request table with timestamps | Existing |
| Admin denies action | Medium | Audit events with actor identification | Existing |
| System denies processing | Low | Structured logging with request IDs | Planned |

### Information Disclosure (Confidentiality)

| Threat | Risk | Mitigation | Status |
|--------|------|------------|--------|
| Resume leak | High | Encryption at rest, access control, audit logs | Planned |
| Profile PII leak | High | PII redaction in logs, encryption, access control | Planned |
| Portal cookie leak | Critical | Encryption with Fernet/AES, secure storage, limited access | Existing |
| LLM prompt data leak | Medium | No PII in prompts, data minimization, provider agreements | Planned |
| Research data leak | Low | Citations only, no raw scraping storage | Planned |
| Database dump | High | Connection encryption, access control, backups encrypted | Planned |
| Error messages leak internals | Medium | Generic error messages in production, structured logs internal | Planned |
| Log data leak | Medium | PII redaction, log aggregation access control | Planned |

### Denial of Service (Availability)

| Threat | Risk | Mitigation | Status |
|--------|------|------------|--------|
| API flooding | High | Rate limiting per IP and per user, WAF rules | Planned |
| Queue flooding | Medium | Queue depth limits, job size limits, consumer scaling | Planned |
| Browser worker exhaustion | Medium | Browser pool limits, circuit breaker, timeout | Existing |
| Database connection exhaustion | Medium | Connection pooling, query timeouts, circuit breaker | Planned |
| LLM provider rate limiting | Low | Multi-provider fallback, request queuing | Existing |
| File upload bombing | Medium | File size limits, type validation, virus scanning | Planned |

### Elevation of Privilege (Authorization)

| Threat | Risk | Mitigation | Status |
|--------|------|------------|--------|
| User accesses another user's data | Critical | Row-level security, ownership checks, query scoping | Planned |
| User escalates to admin | High | Role-based access control, admin endpoints restricted | Planned |
| Service bypasses auth | High | Internal API keys, mTLS, network segmentation | Planned |
| Browser worker escapes isolation | Medium | Process isolation, resource limits, no shell access | Planned |
| LLM prompt injection | High | Input sanitization, prompt templates, output validation | Planned |
| SQL injection | Critical | ORM parameterized queries, input validation (Zod) | Planned |
| XSS in frontend | High | React XSS protection, CSP headers, input sanitization | Planned |
| CSRF | Medium | CSRF tokens, SameSite cookies, origin validation | Planned |

## Attack Scenarios

### Scenario 1: Credential Harvesting via Browser Extension

**Attack**: Malicious browser extension intercepts portal cookies during login.

**Mitigation**:
- Browser extension is sandboxed with minimal permissions
- Cookies are encrypted before transmission
- Session cookies have short expiry
- Manual login required periodically

### Scenario 2: Prompt Injection via Job Description

**Attack**: Attacker crafts job description to inject malicious instructions into LLM prompts.

**Mitigation**:
- Job descriptions are sanitized before prompt insertion
- Prompt templates have strict structure
- Output validation on LLM responses
- No direct execution of LLM output

### Scenario 3: Data Breach via API

**Attack**: Attacker exploits API vulnerability to extract user resumes.

**Mitigation**:
- Zod validation on all inputs
- Row-level security in database
- Rate limiting
- Audit logging
- Encryption at rest

### Scenario 4: Supply Chain Attack

**Attack**: Compromised npm package steals environment variables.

**Mitigation**:
- Lockfile audits
- Dependency scanning (Snyk, Dependabot)
- Minimal dependency tree
- Bun's built-in security features
- No secrets in client-side code

### Scenario 5: Insider Threat

**Attack**: Employee with database access exports user data.

**Mitigation**:
- Encryption at rest (keys in separate system)
- Audit logging for all database access
- Least privilege access
- Data anonymization for analytics

## Security Checklist

### Authentication
- [ ] Password policy enforced (min length, complexity)
- [ ] Multi-factor authentication available
- [ ] Session timeout configured
- [ ] Concurrent session limits
- [ ] Password breach detection
- [ ] OAuth state parameter validation
- [ ] PKCE for OAuth

### Authorization
- [ ] Role-based access control implemented
- [ ] Resource ownership checks on every request
- [ ] Row-level security in database
- [ ] API rate limiting per user tier
- [ ] Admin endpoints restricted

### Data Protection
- [ ] Encryption at rest (AES-256)
- [ ] Encryption in transit (TLS 1.3)
- [ ] PII redaction in logs
- [ ] Data retention policies
- [ ] Secure deletion
- [ ] Backup encryption

### Input Validation
- [ ] Zod schemas on all boundaries
- [ ] File type validation
- [ ] File size limits
- [ ] SQL injection prevention (ORM)
- [ ] XSS prevention
- [ ] CSRF protection
- [ ] Prompt injection filtering

### Infrastructure
- [ ] Network segmentation
- [ ] WAF rules
- [ ] DDoS protection
- [ ] Container security scanning
- [ ] Secrets management
- [ ] Monitoring and alerting
- [ ] Incident response plan

### Browser Automation
- [ ] Browser process isolation
- [ ] No credential storage
- [ ] Session timeout
- [ ] Screenshot verification
- [ ] Anti-bot detection handling
- [ ] No silent submission on low confidence

### Compliance
- [ ] GDPR data handling
- [ ] Data subject access requests
- [ ] Right to erasure
- [ ] Data portability
- [ ] Consent management
- [ ] Privacy policy

## Incident Response

### Severity Levels

| Level | Definition | Response Time |
|-------|------------|---------------|
| P0 | Data breach, system compromise | 15 minutes |
| P1 | Service outage, auth bypass | 1 hour |
| P2 | Performance degradation | 4 hours |
| P3 | Minor bug, cosmetic issue | 24 hours |

### Response Playbook

1. **Detect**: Monitoring alerts, user reports, automated scans
2. **Assess**: Severity, scope, impact
3. **Contain**: Isolate affected systems, revoke compromised credentials
4. **Investigate**: Logs, audit trail, root cause
5. **Remediate**: Fix vulnerability, patch systems
6. **Recover**: Restore services, verify security
7. **Document**: Post-mortem, lessons learned

## Security Contacts

- Security Lead: security@jobblitz.ai
- On-call: oncall@jobblitz.ai
- Incident Response: incident@jobblitz.ai

## Review Schedule

- Threat model review: Quarterly
- Penetration testing: Annually
- Dependency audit: Monthly
- Access review: Quarterly

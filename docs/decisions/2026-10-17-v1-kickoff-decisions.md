---
title: v1 kickoff decisions — the owner's 45 before-start answers
status: accepted
date: 2026-10-17
decided-by: the owner, on the private kickoff decision sheet (submitted 2026-10-17 20:34 UTC)
supersedes: null
superseded-by: null
---

## Context

The v1 parallel programme (`docs/superpowers/plans/2026-10-17-v1-parallel-programme.md`,
ADR-0045) listed 45 decisions that units needed answered before they could start. Each came with
options, a recommended default and its grounds. The owner answered all 45 on a private decision
sheet on 2026-10-17. The sheet's note field is empty for every answer.

This record is the public form of those answers. Three rules shaped it:

- **"Recommended"** means the default pre-filled on the sheet. Two decisions had no pre-filled
  default (`dec-brand-direction`, `dec-ios-manual-pass`). Both count as differing, which gives
  the tally in the W42 journal: **37 answers match the recommended default and 8 do not.**
- **Disclosure** (`rch-d-security-disclosure`, ADR-0045): an answer that would reveal a missing
  or unfixed security control is recorded here as "decided; recorded privately". One answer is,
  and its id is withheld too. The owner holds its full record.
- **No figures.** Prices, rates, entity details and legal texts are not in this file. Records
  that carry them are written for the owner to commit.

60 further decisions are still open (50 before their unit's spec, 10 during build). The programme
plan lists them.

## Decision

### Process and execution (recorded in ADR-0045)

| Id | Question | Answer | Recommended? |
| --- | --- | --- | --- |
| `dec-preview-mode` | Preview: honour the roadmap gate, run alongside the build, or skip? | Run alongside after its safeguards; record the Section 3 and preview-gate suspension in ADR-0045 | Yes |
| `dec-landing-variant` | Pin the tested feature SHA or re-pin to the merge commit? | Pin tested SHA (ADR-0045 keeps the exception for tokens releases) | Yes |
| `dec-push-rights` | Who may push and merge? | Only the conductor pushes/merges; sub-agent permissions deny push; protect meta master | Yes |
| `dec-d9-substitute` | What replaces D9's manual click-through? | Agent Playwright click-through plus batched owner device sessions (owner sessions for children's data or money, as recommended) | Yes |
| `dec-floor-ownership` | Who raises coverage floors? | Conductor sets CI-measured floor on the unit's branch at freshness | Yes |
| `dec-spec-approval` | Who approves specs? | Conductor; owner for children's data, money, legal, new product behaviour | Yes |
| `dec-mypy-gate` | mypy: fix and gate, or stop calling it a gate? | Fix and gate | Yes |
| `dec-ios-manual-pass` | iOS device available? | Run the pass | **No default pre-filled.** The recommendation was conditional ("run it if available in week 1"); the answer confirms a device is available. |
| `dec-launch-shape` | Launch after full v1, or take E4? | Full v1 first | **No.** Recommended: build the full v1 and decide at the Phase B exit. |
| `rch-d-security-disclosure` | Security detail in the public repo? | Private advisory; public docs describe the control after the fix deploys | Yes |

### Scope (recorded in ADR-0046, proposed)

| Id | Question | Answer | Recommended? |
| --- | --- | --- | --- |
| `D-trl-exists` | Free trial lesson in v1? | Drop (ADR) | **No.** Recommended: ship it, with no Stripe object. |
| `D-trl-eligibility` | Trial eligibility and cap? | One per unpaid student, 1 open per parent | Yes. Moot while trials are cut. |
| `dec-group-sessions-scope` | Group sessions and group chats in this programme? | Stay deferred, record the cut | Yes |
| `asm-d-progress-scope` | ProgressSnapshot in v1? | Defer | Yes |

### Lessons, reports and the staff surface

| Id | Question | Answer | Recommended? |
| --- | --- | --- | --- |
| `dec-lesson-outcomes` | Which lesson outcomes exist, when are they recorded, what do they count for? | Delivered/Student absent by teacher (start to +7 days), Teacher absent by staff adjudication only; pay excludes teacher absent | Yes |
| `asm-d-retention` | Retention for reports and ratings? | Plus comments purged after 12 months (the sheet's option 2, after option 1 "Lesson lifetime") | Yes |
| `dec-admin-surface` | Where do staff work? | Dashboard for day-to-day; Django admin break-glass only, recorded as an ADR-0013 amendment | Yes |
| `dec-cur-terminology` | Calls "session", curriculum "lesson"? | Calls become session (curriculum keeps "lesson") | Yes |

### Content and uploads

| Id | Question | Answer | Recommended? |
| --- | --- | --- | --- |
| `dec-cur-storage-provider` | Where do uploads live? | EU private S3 from an existing vendor | Yes |
| `dec-cur-file-policy` | File kinds and caps? | PDF, images, MP3/M4A; video as links | Yes |
| (withheld) | Upload-handling security decision | Decided; recorded privately | Recorded privately |
| `dec-cur-retention` | Upload retention? | Hide then purge at 30 days; photos off the live bucket at once, versions and offsite copy expire within 30 days | Yes |

### Notifications and billing

| Id | Question | Answer | Recommended? |
| --- | --- | --- | --- |
| `D-ntf-template-ownership` | Email copy in code or DB? | Code with gettext | Yes |
| `D-ntf-support-contact` | Support contact in emails? | Monitored support@ (staging uses a default until launch) | Yes |
| `dec-dunning` | Who sends payment-failed notices? | kaleem only | **No.** Recommended: Stripe's emails plus a banner now, kaleem's own notices later. |
| `lb-dec-paid-through` | What does a paid-through customer see? | Active until, block checkout, resume | Yes |
| `dec-live-pricing` | Launch prices and currency? | Individual and Family at owner-set amounts | Yes |

### Legal, privacy and retention

| Id | Question | Answer | Recommended? |
| --- | --- | --- | --- |
| `dec-legal-texts` | Who drafts legal texts? | Agent drafts, counsel approves, owner commits | Yes |
| `rch-d-minors` | Minimum self-registration age and product-spec amendment? | No gate | **No.** Recommended: 16+, with younger children joining through parent-created accounts and protections by age, confirmed with counsel. |
| `dec-cookies` | Non-essential cookies? | None | Yes |
| `lb-dec-legal-entity` | Controller and merchant entity? | Existing Stripe entity | Yes |
| `lb-dec-retention` | Retention for accounts, logs, billing? | 12 months after closure, diagnostics 90d, logs 30d | Yes |
| `dec-retention-new-domains` | Retention for engagement, notification logs, earnings/payouts, trials, analytics caches? | Engagement: account lifetime; notification log 90d; earnings: statutory period; trials 12m; caches ≤24h | Yes. An accountant confirms the earnings period; the trials part is moot. |
| `lb-dec-erasure-semantics` | What does deleting an account mean? | Anonymize in place | Yes |
| `dec-msg-retention` | Message retention? | Assignment plus 12 months | Yes |

### Production and operations

| Id | Question | Answer | Recommended? |
| --- | --- | --- | --- |
| `dec-backup-policy` | Backup target, retention, RPO/RTO? | Encrypted EU offsite, 30-day rolling, RPO 24h, RTO 4h | Yes |
| `lb-dec-prod-hosting` | Production topology? | Separate EU VPS | Yes |
| `lb-dec-turn-host` | Dedicated TURN host? | Dedicated host with turns:443 | Yes |
| `lb-dec-staging-cookie-isolation` | Isolate staging cookies? | Environment-specific names | Yes |
| `lb-dec-monitoring-services` | Monitoring vendors? | Self-hosted | **No.** Recommended: Sentry SaaS plus uptime checks. |

### Brand, marketing and design

| Id | Question | Answer | Recommended? |
| --- | --- | --- | --- |
| `dec-brand-direction` | Brand direction for v1? | Rewrite brief | **No default pre-filled.** The recommendation was to pick in one session, else N4. |
| `dec-brand-extended-programme` | Stationery and deck template in v1? | Defer | Yes |
| `dec-brand-email-header` | Where is the email header built? | Slot in ntf-email-foundation, raster later | Yes |
| `dec-design-sync-disposition` | Adopt the design-sync tooling? | Park (push as backup) | Yes |
| `dec-marketing-site-start` | Start marketing before the brand? | Start now | Yes |

## Why

The sheet showed each decision's options, its recommended default and the grounds for that
default. No reasons were written on it, so this record does not supply any. What is known about
the eight answers that differ:

- **`dec-launch-shape`:** E4 was put to the owner because R2's warning sign is visible. The owner
  chose the full v1 first.
- **`dec-ios-manual-pass`:** an iOS device is available, so the iOS checks run rather than being
  recorded as a deviation.
- **`D-trl-exists`:** the owner chose to drop the trial lesson, knowing it needs an ADR.
- **`dec-dunning`:** the owner chose kaleem as the only sender of payment notices.
- **`rch-d-minors`:** before answering, the owner was told that GDPR Article 8 and COPPA tie a
  child's consent to a parent below 13–16 (by country). The owner kept no age gate. It stays a
  launch risk and goes to counsel with the legal texts.
- **`lb-dec-monitoring-services`:** the owner chose to self-host monitoring. ADR-0006 already
  allows a self-hosted Sentry.
- **`dec-brand-direction`:** the owner chose to rewrite the brand brief before picking any
  direction.
- **One upload-handling security decision:** recorded privately, as W42 already says.

## Consequences

- **Process.** ADR-0045 (accepted, pre-approved by the owner on the sheet) records the execution
  model and every process deviation these answers set.
- **Scope.** ADR-0046 (proposed; the owner approves its text before it merges) records the trial
  cut, the full v1 before launch and group sessions staying deferred.
  `docs/decisions/2026-10-17-v1-scope-supersedes-product-spec.md` reconciles the product spec's
  out-of-scope list.
- **Minors.** `ISSUES.md` carries a *Blocks launch* entry: counsel signs off on the no-age-gate
  position before real users. The unit that would add a gate (`rch-legal-age-gate`) is parked
  and returns only through a new owner decision.
- **Dunning.** kaleem's notices are the only ones a payer gets. Stripe's own failed-payment
  emails are switched off (gate `hg-stripe-customer-emails`) before `ntf-billing-notifications`
  merges and again in live mode. There is no Stripe backstop if kaleem's pipeline fails, so
  worker and beat liveness alarms matter more.
- **Monitoring.** Error tracking and uptime checks run on kaleem's own hosts, and the uptime
  checks run off the box they watch. The ADR-0006 amendment (owned by `lb-uptime-host-alerts`)
  sets the tools, a memory and disk budget per host, the backup scope and an upgrade cadence. No
  monitoring vendor needs a DPA.
- **Brand.** A new unit, `inf-brand-brief-rewrite`, comes before any new exploration. The brand
  chain runs a wave later, no fallback direction is agreed, and launch waits for `inf-brand-close`.
- **iOS.** The iOS passes run on the owner's device: the C3e-a/b iOS checks and the C4–C6 call
  pass in wave 2, and the PWA install in wave 3. `inf-call-specs-close` retires the no-device D9
  deviation and corrects CLAUDE.md's statements that the project has no Apple device (the C3e-a
  and C3e-b D3 rows).
- **Technical answers.** Answers that set architecture get their ADR in the unit that owns them,
  for example the ADR-0006 amendment (monitoring), the ADR-0013 amendment (staff surface) and the
  ADR-0019 amendment (staging cookie names).
- **Retention.** The retention answers feed the retention schedule in `lb-gdpr-governance-docs`
  and the purge jobs, and need counsel's review with the legal texts.

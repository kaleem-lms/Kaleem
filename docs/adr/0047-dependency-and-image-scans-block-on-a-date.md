---
number: 0047
title: The dependency and image scans are report-only until a date written here, then block
status: accepted
date: 2026-10-18
amends: ADR-0030 (the scanner set, and "Submodule histories are not scanned")
---

## Context

ADR-0030 stood up `gitleaks` and `pip-audit` as merge gates and deferred the rest
("`semgrep` and `trivy` in the same PR: deferred deliberately. Both need triage budgets of
their own"). It also named a gap: submodule git histories were unscanned, so a secret
committed and then removed inside `backend`, `dashboard`, `marketing`, `infra` or `tokens`
was caught only by a pre-commit hook on a machine that had one installed.

Three things were therefore still missing: a JavaScript dependency audit for the two
frontends, a vulnerability scan of the images staging runs, and the submodule histories.

Two facts shape how they are added.

- **The frontends have a backlog.** `pnpm audit --prod` over the committed lockfiles reports
  a large number of advisories today. Making that a merge gate on the day it lands would
  turn every PR red for something no PR caused, and a gate people learn to click past is
  worse than none (ADR-0030's own argument). The specifics are kept in the private record
  (owner decision `rch-d-security-disclosure`), not in this public repo.
- **The fixes are dependency bumps, and lockfiles are serialised.** Only one unit per
  repository may change a lockfile at a time, so the backlog cannot be cleared inside this
  change.

The history scan has no backlog. A local run over all five submodule histories found
nothing.

## Decision

**1. Three scans, with the scope stated.**

| Scan | Scope | Blocks |
| --- | --- | --- |
| `gitleaks` v8.30.1, git mode | full history, every ref, of `backend`, `dashboard`, `marketing`, `infra`, `tokens` and the meta repo | immediately |
| `pnpm audit --prod` (pnpm 10) | the committed `dashboard` and `marketing` lockfiles, no install | from the blocking date |
| `trivy` 0.72.0, pinned by digest | the `--target production` images of `backend`, `dashboard`, `marketing`, built as `deploy-staging` builds them and not pushed; `--scanners vuln`, HIGH and CRITICAL, `--ignore-unfixed` | from the blocking date |

Dev-only dependencies stay out of scope (ADR-0030 point 3). Both frontends list their
build tools under `dependencies`, so `--prod` does not remove them; the triage rule below
covers those.

**2. The blocking date is a value in `ci.yml`, and the date guard acts on it.**
`SCA_BLOCKING_FROM` is `2026-11-30`. `.github/scripts/sca-gate.sh` is the only reader.
A scanner **finding** (a dedicated exit code: 5) is a `::warning::` and a step-summary
line of counts per severity before that day, and a failing step on and after it. Only
counts are published: the scanned repositories are private and the Actions page is public,
so the itemised list (package, advisory, fixed version) is never written to the log or
summary. It is reachable by running `pnpm-audit.sh` (`PNPM_AUDIT_DETAILS=1`) or trivy
locally; triage is kept in the private record. Nobody has to remember to flip
a switch. A scanner **error** (registry or database outage, an unparseable report, a
missing tool) fails the step on every day: a broken verifier is never reported as clean.

**3. Moving the date later needs an ADR.** This is the ADR-0026 ratchet rule applied to a
date: a coverage floor that may only go up, a deadline that may only come closer.
Moving it earlier is an ordinary PR once the baseline is clean. If the date arrives before
the fixes do, every PR goes red on an unchanged tree, and that is the intended pressure.
The way out is the fix units or an ADR, never deleting the guard. `lb-security-scanning-sast`
(semgrep) reuses this same date and guard.

**4. Every history scan carries a completeness guard.** `gitleaks` exits 0 having scanned
zero commits when git fails inside its container (observed 2026-10-17). `gitleaks-history.sh`
exits 4 on an `ERR` line, on a shallow repository, or when the commits scanned fall below
the number of non-merge commits that add at least one text line. The bound is a lower
bound, not an equality, by measurement: gitleaks does not count pure renames, pure
deletions, binary-only or empty commits, none of which can introduce a secret.

**5. Allowlists are annotated, in meta, and expire.** After the `.gitleaksignore`
precedent: `.github/security/pnpm-audit-allowlist.txt` (advisory, review-by date, reason;
an expired entry fails the job, whether or not the advisory still exists) and `.trivyignore`
(trivy's own `exp:` syntax). An entry is allowed only for a finding triaged as **not
reachable in what ships**, for example a build-time package that never reaches the
nginx-served static bundle. A reachable finding is fixed, never allowlisted. A review-by
date may lie at most 90 days ahead of the day the check runs. `pnpm-audit.sh` enforces
this, and it is deliberately relative to today and not to the blocking date: a rule tied
to that date would leave no compliant date after it, making the allowlist unusable at the
moment it matters. The trivy side is expired by trivy's own `exp:`; keeping it within 90
days is a review rule that no code checks.

**6. The scanners are tested on every run.** `.github/scripts/test-security-scripts.sh` is
the first step of `security`, table-driven, with no network beyond the pinned image. It
exercises each guard in both directions, including a replay of the silent-zero failure and
a real submodule checkout.

## Alternatives considered

- **Block from day one.** Rejected: it turns every PR red for the existing backlog.
- **Report-only with no date.** Rejected: a report nobody is forced to read is the original
  failure ADR-0030 opened with. The date is what makes the report-only period finite.
- **`aquasecurity/trivy-action`.** Rejected: an unpinned marketplace action changes what
  "green" means without a commit. The scanner is a digest-pinned image, as gitleaks is.
- **Scanning the third-party images** (traefik, postgres, redis, coturn). Rejected: their
  tags float and are pulled on the VPS, so a scan in CI would not be the image that runs.
  Recorded in `ISSUES.md`.
- **`--ignore-registry-errors` on the audit.** Rejected: it converts "the advisory service
  was unreachable" into "no advisories".
- **A single combined baseline file.** Rejected: the two tools have different identifiers
  and different expiry syntaxes; each allowlist uses its tool's native form.

## Consequences

**Good**

- The three scans ADR-0030 listed as absent run. A secret committed and removed in any
  submodule is now found.
- The history scans can no longer pass by reading nothing.
- Report-only is finite: the date blocks by itself.

**Bad / costs**

- **The date turns PRs red on an unchanged tree if the fixes do not land.** Intended.
- `image-scan` builds the three images a second time (a few minutes per PR, at no cost on a
  public repository). A floating base tag could differ between that build and the deploy
  build; accepted.
- Any registry or database outage turns a run red. `pip-audit` already behaves this way, and
  the trivy database is cached per day.
- `--all` scans every ref the checkout fetched, including other open branches, so a
  finding on an unrelated open branch can fail a run. That was already how the meta scan
  behaved.
- `pnpm audit` and `trivy` cover only what public advisory databases know; a git-hosted
  dependency (`@kaleem/tokens`) is covered by neither.

## Not covered

semgrep (`lb-security-scanning-sast`), the third-party runtime images, and git-hosted
dependencies.

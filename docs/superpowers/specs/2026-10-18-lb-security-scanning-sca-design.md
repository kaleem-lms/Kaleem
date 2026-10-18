---
name: lb-security-scanning-sca
phase: v1 (wave 1, platform stream)
modules: [ci security job]
status: draft
created: 2026-10-18
closed: null
---

## Goal

ADR-0030 left three scans unbuilt: `pnpm audit` for the two frontends, `trivy` for
the images staging runs, and `gitleaks` over submodule histories. `ISSUES.md` lists all
three, and the D3 scanner table in `CLAUDE.md` marks them "nowhere yet". This unit wires
all three into `ci.yml`. The two dependency scans start **report-only** and become
**blocking on a date** set in an ADR-0030 amendment this unit owns. Nobody has to
remember to flip a switch: the date guard does it. `lb-security-scanning-sast` (semgrep)
merges after this unit and reuses the same date and guard.

This is a meta-only change, to CI config, scripts and docs. It does not touch the
submodules.

## What runs, where

| Scan | Scope | Job | Blocks |
| --- | --- | --- | --- |
| `gitleaks` v8.30.1, git mode | full history (`--all` refs) of `backend`, `dashboard`, `marketing`, `infra` and `tokens`, plus meta's own history as today | `security` | immediately |
| `pnpm audit --prod` (pnpm 10) | `dashboard/` and `marketing/` committed lockfiles, with no install | `security` | from the blocking date |
| `trivy` 0.72.0 (image pinned by digest) | `--target production` images of `backend`, `dashboard` and `marketing`, built exactly as `deploy-staging` builds them but not pushed; `--scanners vuln --severity HIGH,CRITICAL --ignore-unfixed` | new `image-scan` job | from the blocking date |

- **Prod-only scope**, following ADR-0030 point 3 and the programme review. `--prod`
  leaves out dev dependencies. Both frontends list their build tools under
  `dependencies`, though, so the triage rule below has to cover build-time packages.
- **`gitleaks` blocks at once.** A local run over all five submodule histories found
  nothing (backend 243, dashboard 355, marketing 18, infra 29, tokens 10 commits). So
  there is no baseline to wait for.
- **Placement.** `pnpm audit` joins `pip-audit` in `security`. That job runs even on
  documentation-only changes (ADR-0042) and needs no build. `image-scan` needs a build,
  so it carries the usual `code == 'true' && verified != 'true' && actor != dependabot`
  guard. It is added to the `needs:` of both `record-verified-tree` and
  `deploy-staging`, so flipping it to blocking needs no further edit to the workflow.

## The controls

1. **Completeness guard on every history scan.** gitleaks exits 0 having scanned zero
   commits when git fails inside its container, as the runbook recorded on 2026-10-17.
   The wrapper `.github/scripts/gitleaks-history.sh <dir>` therefore fails (exit 4) on
   any of three conditions:
   - an `ERR` line in the output;
   - a shallow repository;
   - a scanned count below the number of non-merge commits that add at least one text
     line.

   It is a lower bound, not an equality, by measurement: gitleaks does not count pure
   renames, pure deletions or empty commits (infra 29 of 32, tokens 10 of 11). None of
   those can introduce a secret. The meta history step goes through the same wrapper.
2. **Date guard.** The workflow sets one value, `SCA_BLOCKING_FROM: "2026-11-30"`. The
   wrapper `.github/scripts/sca-gate.sh` classifies what each scanner returns:
   - a **finding**, from a dedicated exit code: before the date it becomes a
     `::warning::` plus a step-summary table and exits 0; on or after the date the step
     fails;
   - a **scanner error**, such as a registry or DB outage, unparseable output or a
     missing tool: the step **always fails**. A broken verifier is never reported as
     clean.
3. **Annotated, expiring allowlists in meta**, after the `.gitleaksignore` precedent:
   - `.github/security/pnpm-audit-allowlist.txt` has one advisory per line, with a
     review-by date and a reason. The wrapper filters `pnpm audit --json` against it and
     fails on an **expired** entry.
   - `.trivyignore` uses trivy's native `exp:` syntax.

   An entry is allowed only for a finding triaged as **not reachable in what ships**,
   for example a build-time-only package that never reaches the nginx-served static
   bundle. A reachable finding is fixed, never allowlisted. The reasoning for each entry
   lives in the private record.
4. **Moving the date later needs an ADR.** This is the ADR-0026 ratchet rule applied to
   a date. Moving it earlier is a normal PR once the baseline is clean.

The measured dependency baseline and its triage are kept in the private record
(rch-d-security-disclosure), not here.

## Data model / API / Frontend delta

None. No personal data is stored or read, so ADR-0023's four points do not apply.
Expand/contract: no schema, API or cookie change.

## Module boundaries

None. This is CI only. `ci.yml` is a shared file. `lb-security-scanning-sast` merges
after this unit. `inf-ci-actions-v7` and `ci-parallel-guards` are ready to land and also
edit `ci.yml`, so the conductor resolves the freshness merge.

## Out of scope

- **Fixing what the scans find.** A fix is a dependency bump in `dashboard` or
  `marketing`, and lockfiles are serialized at one dependency-changing unit per repo.
  The conductor queues those units before the blocking date.
- Third-party runtime images (traefik, postgres, redis, coturn). Their tags float and are
  pulled on the VPS, so a scan in CI would not match what runs. That gets one
  `ISSUES.md` line.
- Git-hosted dependencies (`@kaleem/tokens`), which no advisory database covers.
- semgrep (`lb-security-scanning-sast`). Backend dependencies are already covered by
  `pip-audit`.

## Test plan

There is no e2e: no user-facing behaviour changes (D3). Each gate is mutation-checked
instead:

- The self-test `.github/scripts/test-security-scripts.sh` runs as the first step of
  `security`, following the `test-classify-changes.sh` precedent. It is table-driven
  and needs no network:
  - **gitleaks-history** exits 1 on a throwaway repo whose commit carries a fake key.
    The key is built at runtime, so the tree scan does not flag the test itself. It exits
    4 on a shallow clone and 4 when the git dir is unreachable, and 0 on a clean repo.
  - **sca-gate**: a finding exits 0 before the date and 1 on and after it; an error
    exits non-zero on both sides of the date.
  - **pnpm-audit** (`--from-json` fixture): an allowlisted advisory is filtered out, an
    unlisted one is a finding, an expired entry is an error, and malformed JSON is an
    error.
- Live mutation checks, recorded in the hand-back:
  - each wrapper with its guard deleted, where the self-test must go red;
  - trivy against a deliberately old public image, which must report a finding;
  - the date forced into the past on a branch, where `image-scan` and `pnpm audit` must
    go red.
- The first CI run is read in full: each submodule's scanned count, both audits' summary
  tables, and the three image scans.

## Open questions

None. The blocking date (2026-11-30) is this unit's to set under the programme's review
resolution ("scanners get a blocking date and prod-only scope"). It is recorded in the
ADR amendment.

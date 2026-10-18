---
name: lb-security-scanning-sast
phase: v1 (wave 1, platform stream)
modules: [ci]
status: draft
created: 2026-10-18
closed: null
---

## Goal

ADR-0030 deferred `semgrep` ("a SAST tool adopted with 200 findings gets muted within a
week"), and `ISSUES.md` still lists it as running nowhere. This unit adds a semgrep scan
with OWASP-tagged security rules over the code that ships: `backend` (`kaleem`,
`signaling`, `config`) and `dashboard/src`. It reuses `lb-security-scanning-sca`'s date
guard: findings are report-only until `SCA_BLOCKING_FROM` (2026-11-30, ADR-0047) and
block from that day. A scan that failed, or that read less than it should have, fails on
every day.

The unit merges after `lb-security-scanning-sca`, and its build starts from a master
that contains it. It needs `sca-gate.sh`, `test-security-scripts.sh` and ADR-0047.

## What runs, where

| Item | Value |
| --- | --- |
| Scanner | `semgrep/semgrep:1.180.0`, pinned by digest (`sha256:529ee8a2…845c3`), run with `--metrics=off --disable-version-check` and **`--network none`** |
| Rules | `semgrep/semgrep-rules` at a pinned commit, fetched by SHA in CI (`git fetch --depth 1 <url> <sha>`). The commit is a value in `ci.yml` |
| Rule set | the `security` directories for this stack: `python/{lang,django,jwt,cryptography,requests}/security`, `javascript/{lang,browser,jsonwebtoken}/security`, `typescript/react/security`. Measured at the pinned commit, 218 of these 223 rules carry OWASP metadata |
| Targets | `backend/kaleem`, `backend/signaling`, `backend/config`, `dashboard/src` |
| Excluded | test code (`tests/` and `test/` directories, `*.test.ts`, `*.test.tsx`) and the development and CI settings modules (`config/settings/local.py`, `config/settings/test.py`). All of it is listed and annotated in one place, the wrapper |
| Job | new `sast` job in `ci.yml` with the standard `code == 'true' && verified != 'true' && actor != dependabot` guard. It is added to the `needs:` of `record-verified-tree` and `deploy-staging` |

**Why pinned rules and not the registry's `p/owasp-top-ten`?** A registry ruleset
changes without a commit, and it needs semgrep.dev to be reachable at scan time. ADR-0030
and ADR-0047 rejected an unpinned scanner for exactly this reason. The rules are fetched
by commit and not copied into this public repository, because they are published under
their own licence (Semgrep Rules License v1.0). Bumping the image or the rules commit is
an ordinary PR, and any finding it surfaces follows the date guard.

## The controls

1. **`.github/scripts/semgrep-scan.sh`** runs the scan and classifies the result
   (`--from-json <file>` for tests). Its exit codes follow the existing wrappers:

   | Exit | Meaning |
   | --- | --- |
   | 0 | clean |
   | 5 | findings, routed through `sca-gate.sh "semgrep" <rc> 5` |
   | 4 | incomplete, see the completeness guard |
   | 3 | a bad report or a malformed suppression |
   | 6 | semgrep or docker itself failed. Semgrep's own codes include 3, 4 and 5, which would be read as the codes above, so every one of its failures maps to 6 |

   Semgrep runs **without** `--error`, so any non-zero exit from it is a failure and
   never a finding.
2. **Completeness guard (exit 4).** The guard fails the scan in two cases:
   - any entry in the report's `errors` array, including a partial parse, because a
     file semgrep could not fully parse was not fully scanned;
   - a file missing from `paths.scanned`. The expected set is every git-tracked
     `.py/.ts/.tsx/.js/.jsx` file under the targets, minus the wrapper's exclusions.

   The check is a set comparison, not a count, so semgrep's own default ignores cannot
   silently widen the exclusions.
3. **Canary.** Before the real scan, the `sast` job runs the wrapper over
   `.github/scripts/fixtures/semgrep-canary/` (one Python and one TypeScript file, each
   with a known-bad line) and requires exit 5. A ruleset that loaded nothing, or a wrong
   rules path, therefore turns the job red, even though the scan would otherwise read
   "clean".
4. **Suppressions are named and counted.** A false positive gets an inline
   `nosemgrep: <rule-id>`, with the reason in an adjacent comment. The wrapper fails
   (exit 3) on a bare `nosemgrep` that names no rule, because that silences every rule on
   the line. The step summary publishes the suppression count next to the finding
   counts, so a rise is visible in review.
5. **Counts only in public.** The scanned repositories are private and the Actions page
   is public. The log and step summary therefore carry only:
   - finding counts per severity;
   - the suppression count;
   - the number of files scanned per target.

   The itemised list (rule, file, line) is printed only for a local run with
   `SEMGREP_DETAILS=1`. This is the same rule `pnpm-audit.sh` and `trivy-counts.sh`
   follow.

## Baseline triage

The measured baseline and the triage of each finding are kept in the private record
(`rch-d-security-disclosure`), not here. This unit:

- annotates each finding triaged as a **false positive**, in `backend` and `dashboard`.
  The annotations are comments only, with no behaviour change. A template annotation
  must leave the rendered output byte-identical;
- routes any finding triaged as **real** through the private channel, as a fix unit that
  the conductor queues before the blocking date. A real finding is never suppressed.

## Data model / API / Frontend delta

None. No personal data is stored or read, so ADR-0023's four points do not apply. There
is no schema, API or cookie change, so expand/contract does not apply.

## Module boundaries

None. This is CI only, plus comment-only annotations in `backend` and `dashboard`.
`ci.yml` is a shared file, and this unit merges after `lb-security-scanning-sca`.

## ADR

ADR-0047 (the ADR-0030 amendment) gets an addendum section covering the semgrep scope,
the rule pin, the completeness guard and the suppression rule, and drops semgrep from its
"Not covered" list. No new ADR is needed.

## Out of scope

- Fixing real findings: a separate unit, through the private channel.
- Meta's own workflows (`yaml/github-actions/security`), `marketing`, `infra`
  Dockerfiles and compose files: one `ISSUES.md` line, in the conductor's close-out.
- Test code and e2e specs.

## Test plan

There is no e2e: no user-facing behaviour changes (D3). Instead:

- **Self-test.** `test-security-scripts.sh` gains table-driven `semgrep-scan.sh` cases
  over JSON fixtures, with no network:
  - clean gives 0;
  - findings give 5;
  - an `errors` entry gives 4;
  - a missing expected file gives 4;
  - malformed JSON gives 3;
  - a bare `nosemgrep` gives 3;
  - a named `nosemgrep` is accepted and counted;
  - the default output contains no file path or rule id.
- **Canary** in CI on every run, as above.
- **Live mutation checks**, recorded in the hand-back:
  - plant a finding in a backend worktree: exit 5;
  - force the date into the past on a branch: the step goes red;
  - delete each guard from the wrapper: the self-test goes red;
  - remove each annotation: its finding returns.

## Open questions

None. The blocking date is ADR-0047's. The rule set is a pinned subset, chosen above.

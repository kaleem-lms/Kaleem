---
name: ci-cost-optimization
phase: 0
modules: []
status: draft
created: 2026-09-08
closed: null
---

## Goal

CI runs the full eight-job suite on every pull request and then runs it again on the merge
to `master`, regardless of what changed. Forty-three per cent of the meta repo's pull
requests touch only documentation, and every one of them runs the backend test suite,
Playwright, three container builds and a full-history secret scan to prove that a Markdown
file did not break anything.

This spec stops CI doing work that cannot tell us anything, without weakening a gate that
can. It has one measurable target: get the monthly Actions bill down, and say honestly how
far down it gets — which is *not* to zero.

## What it costs today

Measured, not estimated, from run `34177257278` (a push to `master`, 2026-09-08). GitHub
bills each job separately and **rounds every job up to a whole minute**, so the billed figure
is materially higher than the wall-clock sum:

| Job | Wall clock | Billed |
| --- | --- | --- |
| `dashboard-lint` | 4.50 min | 5 |
| `deploy-staging` | 3.03 min | 4 |
| `e2e` | 3.00 min | 3 |
| `backend-test` | 1.52 min | 2 |
| `security` | 0.73 min | 1 |
| `dashboard-build` | 0.67 min | 1 |
| `backend-lint` | 0.52 min | 1 |
| `marketing-build` | 0.42 min | 1 |
| **push to `master`** | | **18** |
| **pull request** (same minus deploy) | | **14** |

Within `dashboard-lint`, 238 of its 270 seconds are `vitest --coverage`. Within
`deploy-staging`, 101 seconds are three uncached `docker build` invocations.

Run volume over the last seven days: **151 runs** — 84 `pull_request`, 57 `push`, 3 nightly
Lighthouse, 3 nightly Stripe test clock, 3 manual dispatches, 1 Dependabot. That is
**~2,260 billed minutes/week ≈ 9,700/month**.

Activity is bursty: the last 30 days as a whole hold only 159 runs, because nearly all of it
landed in the final week. The 9,700 figure is the *current* pace, not a historical average.
It is the right number to design against, because the pace is the working rhythm of the
project, not an anomaly.

### The billing figures in this spec are modelled, not read

The org is on **GitHub Free**: `GET /repos/kaleem-lms/Kaleem/rulesets` returns
`403 Upgrade to GitHub Pro or make this repository public`, and
`GET /repos/kaleem-lms/Kaleem/branches/master/protection` returns empty. Free for
organizations documents 2,000 included Actions minutes per month, with Linux overage at
$0.008/minute.

**The actual invoice was not read.** `GET /orgs/kaleem-lms/settings/billing/actions` returns
`410 This endpoint has been moved`, and its replacement needs the `admin:org` scope, which
this session's token does not have. Every dollar figure below is
`run count × measured per-job billed minutes × published rate`. Treat them as a model whose
*inputs* are measured and whose *output* has never been checked against a bill. Confirming
one month's real invoice against this model is a task in the test plan, not an assumption.

Modelled: ~9,700 min/month, ~7,700 over the allowance, **~$62/month**.

## Where the money goes

Three findings, in order of size.

**1. Documentation pays the full price.** Twenty-six of the last sixty pull requests
(`#187, #181, #180, #179, #177, #175, #173, #171, #168, #161 …`) touched only `docs/**` and
root Markdown. There are no path filters anywhere in `ci.yml`. Each costs 14 minutes on the
PR and 18 more on the merge.

**2. Every merge pays twice.** For a `pull_request` event, `actions/checkout` checks out the
*merge ref* — master with the branch merged in. That is the same content the merge commit
will have. The push run re-derives a result the PR run already has, at 14 minutes a time,
57 times a week.

**3. Dependabot bills six minutes to fail.** `.github/dependabot.yml` is the unmodified
cookiecutter-django file: nine ecosystems on `interval: daily`, seven of them pointed at
`compose/local/django/`, `compose/production/traefik/` and similar — **all seven confirmed
absent** from this repo — plus a `pip` entry for a root `requirements*` that does not exist.
Only the `github-actions` entry produces anything, and those PRs can never pass: a Dependabot
pull request cannot read `secrets.SUBMODULE_TOKEN`, so the recursive submodule checkout dies
in every job. Run `34107074396` billed 6 minutes across six jobs that each failed inside 31
seconds. Three such runs on 2026-09-07 alone.

## The change

### 1. A single `triage` job

A job that is skipped by an `if:` condition causes its dependents to skip as well. So change
detection and the deploy guard cannot be two jobs — the guard would have to run on pull
requests too, and GitHub's **one-minute floor per job** would charge for it every time.
They are one job:

```text
triage   (always runs, ~15s wall, bills 1 min, no submodules)
  outputs:
    code      "false" iff every changed path is docs/** or a root *.md
    verified  "true"  iff a green run already tested this exact tree
              (always "false" on a pull_request event — the lookup runs only on push)
```

All seven gate jobs carry the *same* condition, which is what makes it cheap to extend:

```yaml
if: >-
  needs.triage.outputs.code == 'true'
  && needs.triage.outputs.verified != 'true'
  && github.actor != 'dependabot[bot]'
```

The third clause is explained in part 5.

### 2. The classifier is an allowlist that fails toward running

`.github/scripts/classify-changes.sh` takes a base and a head ref and emits `code=true|false`.
A change is documentation-only **only if every** path matches `docs/**` or a root-level
`*.md`. The `case` statement's default branch is `code`, so a path nobody anticipated runs
the full suite rather than being silently skipped.

Explicitly classified as **code**, not docs:

- anything under `.github/**` — a CI change must be tested by the CI it changes
- any submodule pointer (`backend`, `dashboard`, `marketing`, `infra`, `tokens`) — a pointer
  bump *is* a code change, and it is the whole reason the gates exist in the meta repo
- `.gitleaksignore` — it changes what the `security` job considers green

Diff ranges: `merge-base(base, head)..head` for a pull request,
`github.event.before..github.sha` for a push. When `github.event.before` is the all-zero SHA
(new branch, force-push) the classifier returns `code`.

`.github/scripts/test-classify-changes.sh` holds table-driven cases and runs **as a step of
the `triage` job itself** — about a second, no separate job, no extra billed minute. The
thing that decides what to skip is therefore checked on every single run. This is deliberate:
the recurring failure of the last phase was a verifier that was itself unverified.

### 3. The deploy guard compares tree hashes

A tree hash is content-addressed and includes submodule gitlinks. Two commits with identical
content have identical tree hashes regardless of how they were produced — so this works the
same under merge, squash and rebase merges.

On a pull request, `actions/checkout` gives us the merge ref, so `git rev-parse HEAD^{tree}`
**is** the tree that was tested. A new job records it:

```text
record-verified-tree
  needs: [triage, backend-lint, backend-test, dashboard-lint,
          dashboard-build, marketing-build, e2e, security]
  if:    github.event_name == 'pull_request' && needs.triage.outputs.code == 'true'
         && all gates succeeded
  → uploads a ~20-byte artifact named  verified-tree-<hash>,  retention 7 days
```

On a push to `master`, `triage` computes `HEAD^{tree}` and queries
`GET /repos/{owner}/{repo}/actions/artifacts?name=verified-tree-<hash>`:

- **found** → `verified=true`; the seven gates skip, `deploy-staging` runs
- **not found** → `verified=false`; the full suite runs, then `deploy-staging`

A direct push to `master`, a force-push, a merge of a PR whose green run has aged past the
7-day artifact retention, and a merge where `master` moved underneath the PR all produce a
tree with no recorded green run, and all therefore run the full suite. Nothing about this
requires a human to remember a rule.

The `record-verified-tree` job is skipped on a documentation-only PR, because its gates were
skipped. That is correct and self-consistent: the matching documentation-only push has
`code=false`, so it skips the gates *and* the deploy.

### 4. `deploy-staging` needs explicit result checks

Its `needs:` list will now routinely contain legitimately skipped jobs, and GitHub's default
`if:` semantics ("every needed job succeeded") would skip the deploy along with them. It
becomes explicit:

```yaml
if: >-
  !cancelled()
  && !contains(needs.*.result, 'failure')
  && github.ref == 'refs/heads/master'
  && github.event_name == 'push'
  && needs.triage.outputs.code == 'true'
```

This is the fiddliest expression in the change. It is verified by execution on a real branch
before the pull request opens, not by reading documentation — see the test plan.

### 5. Dependabot and the nightlies

`.github/dependabot.yml` is rewritten: delete the seven phantom Docker ecosystems and the
root `pip` entry, keep `github-actions`, move it from `daily` to `weekly`.

Dependabot's PRs still cannot read `secrets.SUBMODULE_TOKEN`, so they would still bill six
minutes to fail. **All seven gate jobs check out submodules recursively** — not four, as an
earlier reading of `ci.yml` suggested — so every one of them is unrunnable for a Dependabot
actor, and every one of them already carries the identical `if:` from part 1. The
`&& github.actor != 'dependabot[bot]'` clause therefore costs one line in an expression that
is repeated seven times regardless; no third `triage` output is needed.

A Dependabot PR is then `triage` alone: one billed minute, and the only check it can
meaningfully pass — the classifier self-test, which needs neither submodules nor a secret.
The trade is stated plainly: **a Dependabot action bump is no longer tested by this CI before
it is merged.** That is not a regression, because today it is not tested either — it fails at
checkout — it is just no longer six minutes of failing to test it. Reviewing an Actions
version bump by hand is the compensating control, and it is what already happens.

Lighthouse and the Stripe test clock move from nightly to weekly (`cron` day-of-week pinned).
Both measure external drift, not our own commits; ADR-0030 and the Stripe harness spec both
justify them as out-of-merge-path signals, and neither argument depends on a 24-hour period.
56 billed minutes a week becomes 8.

## What this buys, and what it does not

| | now | after |
| --- | --- | --- |
| documentation-only PR run | 14 min | **1** |
| code PR run | 14 min | 16 |
| push to `master`, tree verified | 18 min | **5** |
| documentation-only push | 18 min | **1** |
| Dependabot PR | 6 min | 1 |
| nightlies | 56 min/wk | 8 min/wk |
| **per week** | ~2,260 | **~1,035** |
| **per month (modelled)** | ~9,700 · **~$62** | ~4,430 · **~$19** |

A 54% cut. The weekly figure is
`34×1 (docs PR runs) + 50×16 (code PR runs) + 23×1 (docs pushes) + 34×5 (verified pushes) + 8
(nightlies) = 1,035`, against a measured baseline of 84 PR runs and 57 pushes per week.

One soft input: the 43% documentation-only figure is measured over *pull requests*, and the
split is applied here to *runs*. A branch that gets three pushes produces three runs, and code
branches are pushed to more often than documentation branches, so 43% of PRs is probably fewer
than 43% of runs. The model uses 40% to lean against that, but it is the least solid number in
this spec — and it is the one the real invoice will correct.

**Two things this table is not hiding.** A code pull request gets *more* expensive, by two
minutes: `triage` and `record-verified-tree` each pay the one-minute floor. The guard is paid
for on pull requests and redeemed on pushes; it nets strongly positive only because merges
are frequent here.

And **this does not reach $0.** The residual ~2,430 overage minutes are two things: every one
of the seven jobs pays 30–40 seconds of checkout-with-five-recursive-submodules plus toolchain
setup before it does any work, and `vitest --coverage` takes 238 seconds. Both are real and
both are out of scope here — see below.

## Out of scope

Deliberately excluded, so the diff stays reviewable and the risky work is its own decision:

- **Merging the seven gate jobs into roughly four** to stop paying checkout-and-setup seven
  times over. Real savings, but it rewrites every job and trades wall-clock for minutes.
- **Caching pip, the Playwright browser, and Docker layers.** Worth less than it looks under
  per-job minute rounding — a job going from 1.52 to 1.1 minutes still bills 2 — so it only
  pays where it crosses a minute boundary.
- **Making `vitest --coverage` faster.** The largest single line item, and the one most likely
  to change what "green" means. It deserves its own spec.
- **A self-hosted runner.** Would take Actions minutes to zero for a fixed ~$6–12/month, but
  puts CI on infrastructure we maintain and, if hosted on the staging box, in contention with
  staging.
- **Per-repository gate granularity** — skipping `backend-test` when only the `marketing`
  pointer moved. Tempting, but `e2e` and `lint-imports` span repositories, and getting it
  wrong skips a gate that mattered. One boolean now.
- **Changing any coverage floor, e2e flow, or scanner.** Nothing in this spec alters what a
  gate checks; it only changes *when* a gate runs.

## Test plan

The classifier and the guard are the two things that can silently skip a gate, so both are
verified by breaking them, not by watching them pass.

**Classifier, automated.** `test-classify-changes.sh` runs in `triage` on every run and must
cover: docs-only; docs plus a submodule pointer; a submodule pointer alone; a `.github/**`
change alone; a `.gitleaksignore` change alone; an unrecognised top-level path; an empty diff;
and the all-zero `before` SHA. Mutation check: invert the default branch of the `case`
statement to `docs` and confirm the suite goes red.

**Classifier, on a real branch.** Push a docs-only commit and confirm exactly one job runs.
Push a commit touching one submodule pointer and confirm all seven gates run.

**Guard, both directions.** This is the D9 manual check and it is the one that matters:

1. Open a code PR, let it go green, merge it. Confirm the `master` push run skips the seven
   gates, that `deploy-staging` still runs, and that staging receives the new images.
2. Push a commit directly to `master` that no PR ever tested. Confirm `triage` reports
   `verified=false` and the **full suite runs**. Without this half, a guard that always
   returns `true` would look identical to a working one.
3. Confirm a documentation-only push to `master` runs neither the gates nor the deploy.

**`deploy-staging`'s `if:` expression.** Verified by execution, on a scratch branch with the
job's body replaced by `echo`, across all four combinations of (gates skipped / gates run) ×
(code / docs). GitHub's `needs.*.result` semantics around skipped jobs are exactly the kind of
thing that reads correctly and behaves otherwise.

**The billing model.** After one full month, read the real invoice — with a token carrying
`admin:org`, or from the billing page — and compare it against this spec's ~$19 projection.
If the model is wrong, the number to correct is in this file.

## What this spec cannot prove

- **That the modelled savings match a bill.** Every figure here is derived from run counts and
  measured job durations against the published rate. The invoice was never read (see above).
  The *shape* of the saving — 14 billed minutes becoming 1 on a docs PR — is arithmetic on
  measured values and is solid; the monthly dollar total depends on a run-rate that varies by
  a factor of six between the last 7 days and the last 90.
- **That a tree hash recorded by a green PR run means that PR was correct.** It means the same
  content passed the same gates. If a gate is weak, this change propagates that weakness one
  merge sooner; it does not create it.
- **That skipping gates on a verified push is safe against a compromised artifact.** Any actor
  who can upload an artifact to this repository can name it `verified-tree-<hash>` and cause a
  matching push to skip its gates. On a private repository with one collaborator this is not a
  meaningful threat, and it is strictly weaker than that actor's existing ability to push to
  `master` directly. It is recorded here rather than discovered later.

## Risks

- **The classifier is the only thing standing between a code change and a skipped gate.** It
  is 30 lines of shell. That is why it self-tests on every run and why its default is `code`.
- **There is no branch protection to fall back on.** GitHub Free provides none for private
  repositories, and none is configured. "Green CI before merge" (D5) is a habit, not an
  enforced gate, today and after this change. This spec does not make that worse, but it does
  make the habit's absence more consequential, because the push run stops being a second
  chance to notice.
- **Artifact retention is a silent expiry.** A PR that goes green and is merged eight days
  later runs the full suite. Correct behaviour, but it will look like the guard is broken.
  The runbook note must say so.

## Open questions

None. The one that was open at drafting — whether the Dependabot short-circuit should be a
`github.actor` clause or a third `triage` output — resolved on inspection: all seven gate jobs
already share one identical `if:` expression, so the clause is free and the extra output would
be indirection for its own sake.

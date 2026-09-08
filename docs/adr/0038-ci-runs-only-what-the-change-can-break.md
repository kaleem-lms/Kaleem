# ADR-0038: CI runs only what the change can break

**Status:** Accepted
**Date:** 2026-09-08
**Related:** ADR-0028 (trunk-based, a merge to the meta trunk is a deploy), ADR-0029 (API
versioning enforcement, the previous CI-as-gate change), `docs/superpowers/specs/2026-09-08-ci-cost-optimization-design.md`

## Context

`ci.yml` ran the full eight-job suite — backend lint, backend tests, dashboard lint,
dashboard build, marketing build, `e2e`, `security`, `deploy-staging` — on every pull request
and again on every merge to `master`, regardless of what changed. Twenty-six of the last
sixty meta pull requests (43%) touched only `docs/**` or a root Markdown file, and each of
them ran the same suite that proves a backend model migrated correctly. Every merge then
re-ran the whole suite a second time on a tree its own pull request had already proved green,
because a `pull_request` event and the `push` event that follows its merge check out the same
content.

The org is on GitHub Free: `GET /repos/kaleem-lms/Kaleem/rulesets` returns `403 Upgrade to
GitHub Pro or make this repository public`, and `GET
/repos/kaleem-lms/Kaleem/branches/master/protection` returns empty. There is no branch
protection anywhere in this repository, so there is also no required-check mechanism CI could
lean on — anything CI decides not to run is not enforced by GitHub, only by whether someone
looks.

## Decision

A single `triage` job runs first on every event and emits two outputs: `code` (`false` iff
every changed path is `docs/**` or a root `*.md`) and `verified` (`true` iff a green run
already tested this exact git tree — always the empty string on a pull request, since the
lookup only runs on `push`). All seven gate jobs share one condition —
`needs.triage.outputs.code == 'true' && needs.triage.outputs.verified != 'true'` — so a
documentation-only change or an already-proven tree skips them.

The two questions are one job, not two, because a job skipped by `if:` also skips its
dependents: a separate guard job would have to run on pull requests too, and GitHub's
one-minute floor per job would bill for it every time. Merged into `triage`, the guard is
free.

The guard is a content-addressed tree-hash comparison, not a branch or commit check.
`record-verified-tree` uploads a tiny artifact named `verified-tree-<hash>` when every gate
passes on a pull request's merge ref. On the following push, `triage` computes the same hash
and queries the Actions API for an unexpired artifact of that name. A tree hash includes
submodule gitlinks and is identical under merge, squash or rebase, so this works regardless
of how the PR lands.

Every job gets `timeout-minutes` set to roughly 3× its measured wall clock. `ci.yml` had none
anywhere — GitHub's default is 360 minutes per job, and one hung process would bill six hours,
more than two weeks of this change's savings. `dependabot.yml` is trimmed to the one ecosystem
that produces anything (`github-actions`) and moved from daily to weekly. Lighthouse and the
Stripe test-clock harness move from nightly to weekly, since both measure external drift
rather than our own commits.

## Alternatives considered

**Workflow-level `paths-ignore`.** The simplest possible fix, and rejected for a specific
reason: a required check that `paths-ignore` causes to never run stays pending forever on a
protected branch, which would matter the instant branch protection is enabled on this repo.
The `triage`-and-skip design instead makes every job run and report a real (skipped) status,
so it degrades safely into a future with branch protection rather than needing to be revisited
first.

**Merging the seven gate jobs into roughly four**, to stop paying checkout-and-toolchain-setup
seven times over. Real savings — each job pays 30–40 seconds before doing any work — but it
rewrites every job in the file and trades wall-clock for minutes. Deferred; the diff for this
change stays reviewable because it changes *when* jobs run, not *what* they do.

**A self-hosted runner.** Would take Actions minutes to zero for a fixed ~$6–12/month.
Rejected for now: it puts CI on infrastructure this project maintains, and the natural
place to host it — the staging box — would put CI in resource contention with staging itself.

## Consequences

**A code pull request costs about two billed minutes more.** `triage` and
`record-verified-tree` each pay GitHub's one-minute floor per job on every PR run, even a
tiny one. The guard is paid for on pull requests and redeemed on merges — net strongly
positive only because merges are frequent here, which they are.

**The push run stops being a second chance to notice a red gate.** Before this change, a
merge to `master` re-ran the full suite, so a gate that was somehow wrong on the PR (a flaky
pass, a reviewer merging before the run finished) got one more shot at going red before
`deploy-staging` shipped it. That second run is now skipped whenever the guard matches. With
no branch protection anywhere on this repository, "green CI before merge" (D5) has always been
a habit rather than an enforced gate — this change does not create that gap, but it makes the
habit's absence more consequential, because the push run is no longer there to catch a lapse
in it.

**Dependabot PRs now report green where they previously reported red, and that is a real
regression, not a wash.** Every gate already carried `github.actor != 'dependabot[bot]'`
because Dependabot cannot read `secrets.SUBMODULE_TOKEN` and every job died in checkout
anyway — six billed minutes to fail, testing nothing. Skipping those jobs outright is
cheaper and no less honest about what got tested. But GitHub counts a *skipped* required
status check as satisfying that check, where a *failed* one does not. If branch protection is
ever turned on, a Dependabot PR would appear mergeable with a clean row of green checks and
zero verification behind any of them — worse than today's red-and-obviously-broken state,
because it looks trustworthy. Three such PRs are open right now: #182 (`setup-python` 5→7),
#183 (`upload-artifact` 4→7), #184 (`setup-node` 6→7). `ci.yml` pins `upload-artifact@v4`, so
#183 is a real version upgrade this repository has not taken yet, and it deserves a deliberate
look rather than a merge on the strength of a green tick that tested nothing.

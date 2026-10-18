---
spec: docs/superpowers/specs/2026-10-18-lb-live-captions-decision-design.md
status: done (statement draft awaits the owner commit)
---

# Plan: lb-live-captions-decision

Size S, about one day, plus the wait for the owner's answer. Repo: meta only.

- Meta worktree: `/home/abdulkhalek/Projects/kaleem-worktrees/meta-lb-live-captions-decision`,
  branch `feat/lb-live-captions-decision`.
- No submodule worktree, no migrations, no dependency change, no env var, no floor edit, no
  ship.sh change. The ADR number comes from the conductor (step 0). It is written `0054`
  below.
- Nothing security-sensitive is expected. If something is, it goes to
  `_ops/private/lb-live-captions-decision.md` (mode 600) and never into the repo.

## Files

| File | Change | Committed by |
| --- | --- | --- |
| `docs/adr/0054-live-lesson-captions-position.md` | new, `amends: ADR-0040` | agent |
| `docs/adr/0040-replace-the-palette-and-adopt-en-301-549.md` | one `AMENDED BY ADR-0054` marker in Decision 5 (the ADR-0030 precedent) | agent, after the answer |
| `ISSUES.md` | the clause-7 entry under Blocks launch cites ADR-0054 and states what still blocks launch | agent, after the answer |
| `docs/decisions/2026-10-18-accessibility-statement-draft.md` | new, **left uncommitted** | owner (`dec-legal-texts`) |
| this spec and plan | status updates | agent |

## Steps

TDD for a docs spike: write each check before the text it checks, and watch it fail first.

1. [ ] **Checks first.** In the scratchpad (never committed), write `claims.sh`. It re-runs
   the spec's code claims against pinned SHAs and prints each result:
   - `git -C <K>/dashboard grep -n -i "caption\|transcri\|SpeechRecognition\|createDataChannel" <sha> -- src`
     must print nothing.
   - `MEDIA_LINES` in `usePeerConnection.ts` must list exactly `audio`, `camera`, `screen`.
   - `git -C <K>/marketing grep -n -i "wcag\|301 549\|accessib" <sha> -- src` must print
     nothing.

   Fetch the current `origin/main` SHAs first, and record them in the ADR. Positive
   control: run each grep once with a term known to exist (`addTransceiver`), and see it
   print, so an empty result means "absent", not "broken command".
2. [ ] **Link check.** Write `links.sh`, which resolves every relative Markdown link in the
   files listed above. Run it on a scratch copy with one broken link and see it fail.
3. [ ] **Clause applicability (primary sources only).** Read the EN 301 549 version current
   at writing (ETSI, free PDF) for clauses 6 (incl. 6.2 RTT and 6.5 video), 7.1 and
   9.1.2.4, and W3C Understanding SC 1.2.4. Quote each, with version and section, in the
   ADR's Context. Conclude which clauses bind a two-person live lesson, and whether ADR-0040's
   "clause 7" framing holds. Use WebFetch. If a source cannot be reached, say "unverified"
   in the ADR, never paraphrase from memory.
4. [ ] **Options memo.** In the ADR's Context and Alternatives, write O1–O6 from the spec's
   table. Each gets ADR-0023's four points, what it touches (ADR-0039, ADR-0035, infra,
   boundary contracts), browser coverage with a vendor-doc citation (including where each
   browser's speech recognition sends audio), Arabic and recitation quality marked
   "unmeasured" unless a primary source measured it, and a size class. Status `proposed`.
   Recommendation: O1, matching `lb-dec-en301549`'s recommended option. Say whether O6 is
   worth a post-launch unit, and if so under which clause.
5. [ ] **Commit the spike's first half.** Run `claims.sh` and `links.sh` (both green), then
   `git add` the ADR, spec and plan by path. Message:
   `docs: proposed ADR-0054, live-lesson captions position`.
6. [ ] **Ask.** Hand the ADR to the conductor, who puts `lb-dec-en301549` to the owner with
   it. The unit waits here. Other units are unaffected.
7. [ ] **On the answer.** Set the ADR to `accepted`, with `decided:` and the answer. Add the
   `AMENDED BY ADR-0054` marker to ADR-0040 Decision 5. Rewrite the ISSUES entry. For O1:
   it stays under Blocks launch until `rch-mkt-legal-pages` publishes the statement, and the
   captioning work goes under Someday with its clause. For "build now": the entry names the
   new captioning unit to be allocated, and the conductor escalates the scope growth. For
   "WCAG claim only": the ADR withdraws ADR-0040's EN 301 549 adoption for live lessons, and
   says how far the withdrawal reaches.
8. [ ] **Statement draft.** Write `docs/decisions/2026-10-18-accessibility-statement-draft.md`
   against the spec's shape. Before writing a section, add its rows to the ADR's
   claims-to-evidence table (sentence → D3 row or stated gap). Then write only sentences
   that have a row. Use placeholders for the entity, contact and enforcement route. Put the
   counsel questions (is a statement required, is there an exemption, what is the
   enforcement body) in a list at the top of the draft. **Do not `git add` it.**
9. [ ] **Disclosure pass.** Read the ADR, the ISSUES edit and the draft against
   `rch-d-security-disclosure`: only controls and stated gaps, nothing beyond public
   `ISSUES.md`, no entity details.
10. [ ] **Commit and hand back.** Commit the ADR, ADR-0040, ISSUES.md, spec and plan by
    path, with `PIP_CONFIG_FILE=/dev/null`, never `-A`, never `--no-verify`. Message:
    `docs: accept ADR-0054; ISSUES clause-7 entry`. Then run the hand-back checks:
    - `git -C <MW> fetch origin master`, then `merge-base --is-ancestor origin/master HEAD`;
    - `status --porcelain` shows only the uncommitted draft, which is expected and named in
      the hand-back;
    - `"${R}/_tools/gitleaks-range.sh" <MW> origin/master..HEAD` ends `CLEAN: N of N`.

    The hand-back notes `needs: hg-owner-commit` for the draft.

## Gates

- No backend or dashboard gate: no code changes. The coverage floors are untouched.
- `claims.sh`, `links.sh` (steps 1 and 2) and `gitleaks-range.sh` over
  `origin/master..HEAD`.
- CI on the meta PR: docs-only. Gitleaks does not skip docs (ADR-0042).

## e2e

None. No user-facing behaviour (D3). No row is added to the D3 table. The statement page's
flow belongs to `rch-mkt-legal-pages`.

## Risks

- **Claiming from memory.** Clause text and browser speech-service behaviour are easy to
  half-remember. Mitigation: step 3's quote-or-"unverified" rule, and step 4's vendor-doc
  citations.
- **The statement overclaims.** This project has twice had a gate pass while proving
  nothing (ADR-0040, the design-system v2 work). Mitigation: the claims-to-evidence table is
  written before the prose. Safari and iOS are always named as unverified.
- **"Build now" grows scope** past S. If chosen, this unit still ends at the accepted ADR,
  and the build becomes a new unit (an escalation trigger, raised by the conductor).
- **The legal question is unanswered when the draft is written.** The draft carries the
  counsel questions and does not resolve them. Publication waits for `hg-counsel-review`
  anyway.
- **The uncommitted draft is lost** if the worktree is removed before the owner commits it.
  Mitigation: the hand-back names the path, and the conductor keeps the worktree until
  `hg-owner-commit`.

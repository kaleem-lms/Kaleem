---
name: lb-live-captions-decision
phase: v1 (wave 1, legal stream)
modules: [call]
status: draft
created: 2026-10-18
closed: null
---

## Goal

ADR-0040 adopted EN 301 549 and said in the same breath that kaleem cannot meet it for
live lessons: "the one clause with real teeth for kaleem is clause 7 — captions and audio
description for video", tracked in `ISSUES.md` under **Blocks launch**. This unit turns
that open item into a stated position before launch. It produces three things and ships no
product code:

1. **An options memo** inside a `proposed` ADR that amends ADR-0040 clause 5: each way of
   captioning a live lesson, what it costs in privacy, and what it touches.
2. **The owner's answer to `lb-dec-en301549`** ("Captions now or later?" — options: state
   the gap and caption after launch (recommended); build now; claim WCAG only). The
   decision is `during-build`: the ADR is how it is put to the owner, and the ADR is
   accepted with the answer.
3. **A draft accessibility statement** for `rch-mkt-legal-pages` to publish. It says what
   the decision means for users, in the words the gates can back.

Decision ids: `lb-dec-en301549` (open, asked here), `dec-legal-texts` (agent drafts,
counsel approves, owner commits), `dec-spec-approval`.

### What the code says today

Dashboard `origin/main` d3101e5, backend `origin/main` d1c2be6, marketing `origin/main`
7415349:

- A call has exactly three pre-negotiated media lines, `audio`, `camera` and `screen`
  (`dashboard/src/features/call/usePeerConnection.ts`, `MEDIA_LINES`; ADR-0039). There is
  **no data channel**, so there is no path in the call for text of any kind.
- Nothing in `dashboard/src` mentions captions, transcription or speech recognition.
- Media is peer-to-peer, or relayed by coturn. Neither signaling (ADR-0035) nor any kaleem
  server sees decrypted audio. The backend stores no recording, and the call models
  (`Room`, `CallDiagnostic` in `kaleem/scheduling/models.py`) hold no media.
- Rooms hold two people. Group calls are deferred (ADR-0034, ADR-0046), so a third
  participant, such as a human captioner, cannot join a v1 room.
- Neither surface claims conformance today: no "WCAG", "EN 301 549" or accessibility page
  in marketing `src` or the dashboard.

### The question the memo must answer first: which clauses apply

ADR-0040 names clause 7. That is unverified, and it may be the wrong clause or not the only
one. The memo checks against the standard's text, and cites the version it read:

- **Clause 6** (ICT with two-way voice communication), including real-time text and the
  video-communication requirements (resolution and frame rate for sign language). A live
  1-on-1 lesson is two-way voice and video, so clause 6 may matter more than clause 7.
- **Clause 7.1** (caption processing). Does it require captions to be created, or only that
  captions which exist are shown?
- **Clause 9.1.2.4** (WCAG 2.2 SC 1.2.4, Captions (Live)). Does W3C's Understanding
  document treat a two-way call between individuals as in scope?

Whatever the answer, the ADR records it, and if ADR-0040's "clause 7" framing was wrong it
says so.

### The options the memo compares

| | Option | Where audio or text goes |
| --- | --- | --- |
| O1 | No captions at launch; the gap is stated in the accessibility statement | nowhere new |
| O2 | Each sender's browser recognises its own speech and sends text to the peer over a new data channel | the browser vendor's speech service, unless the browser recognises on-device |
| O3 | Self-hosted speech-to-text | a kaleem server that must decrypt the media, which breaks peer-to-peer |
| O4 | A third-party captioning or speech-to-text vendor | a new processor |
| O5 | A human captioner | a third participant, which v1 rooms of two cannot hold |
| O6 | Not captions: in-call text between the two people | a data channel, peer to peer |

`lb-dec-en301549`'s options map onto these: "state the gap" is O1 (optionally plus O6),
"build now" is O2, O3 or O4, and "WCAG claim only" drops the EN 301 549 claim.

For each option the memo gives:

- **ADR-0023's four points:** what personal data, why, for how long, who sees it. Voices
  and transcripts of lessons are new personal data, and many speakers are children.
  Recitation is religious content.
- **What it touches:** ADR-0039 (a data channel adds an `application` line to the
  pre-negotiated set), ADR-0035 (signaling), infra, and the boundary contracts.
- **Browser coverage:** which target browsers support it at all. Safari and iOS cannot be
  verified in this project (no Apple device; ADR-0040, C3e).
- **Quality for Arabic and Quranic recitation:** stated as unmeasured unless a primary
  source measures it. No prototype is built.
- **Size class**, against the programme's sizes.

## User flow

None in this unit. The flow that follows comes later, in `rch-mkt-legal-pages`: a visitor
opens the accessibility page from the footer, in English or Arabic, and reads what is and
is not accessible, how kaleem checked, and how to report a barrier.

## Data model delta

None. No model, no migration, no code.

ADR-0023's four points for this unit:

- **What:** no personal data. The unit is desk research on public sources and this repo.
- **Why, how long, who sees it:** not applicable.

The ADR states the four points **per option**, because O2–O4 would each add a new category
of personal data (lesson audio and transcripts).

Expand/contract: only docs reach the trunk. The blue-green window is unaffected.

## API delta

None.

## Frontend

No dashboard or marketing slice in this unit. Publishing the statement is
`rch-mkt-legal-pages` (wave 4, marketing), which depends on this unit. If the owner chooses
"build now", the captioning feature gets its own spec and unit, and this ADR scopes it.

## The accessibility statement draft

- **Home:** `docs/decisions/2026-10-18-accessibility-statement-draft.md`, written in the
  unit's meta worktree and **left uncommitted** (`dec-legal-texts`;
  `docs/decisions/README.md`: written, not auto-committed). The owner commits it.
  Counsel's review is batched under `hg-counsel-review` in `rch-mkt-legal-pages`, before
  publication.
- **Language:** English. Arabic legal wording is `rch-mkt-legal-pages`'s, with counsel.
- **Shape:** the sections of the EU model accessibility statement, as a structure only.
  Whether a statement is legally required of kaleem at all (for example under the European
  Accessibility Act, and whether an exemption applies) is a question for counsel. The draft
  lists it and does not answer it.
  - scope: the marketing site and the dashboard, both languages, right-to-left included;
  - the standard targeted and the conformance status, which is "partially conformant" and
    never a flat claim;
  - what is not accessible: live-lesson captions per the decision, Safari and iOS
    unverified, and any open accessibility item that `ISSUES.md` or a launch unit lists
    publicly at the time of publication;
  - how kaleem checked: the gates named in CLAUDE.md D3, and nothing beyond them;
  - feedback and contact, and the enforcement route.
- **Placeholders:** the entity, contact address and enforcement route are placeholders.
  Real entity details are `hg-legal-entity`'s, and specs carry none.
- **Rule:** every factual sentence in the statement maps to a gate in the D3 table or to a
  stated gap. The ADR carries that map.

## Module boundaries

None changed. The call feature (`dashboard/src/features/call`, backend `scheduling` and
`signaling`) owns any future captioning. Under O2 or O6 the boundary is ADR-0039's
pre-negotiated lines. Under O3 or O4 it is new infrastructure and a new processor, which
needs its own ADR, and is probably E5 territory for O3.

## Out of scope

- Building captions, a data channel or in-call text, whatever the decision is.
- Publishing the statement, and the Arabic version (`rch-mkt-legal-pages`).
- Legal applicability (European Accessibility Act, exemptions, enforcement bodies):
  counsel.
- Re-auditing WCAG conformance. The statement reports existing gates and does not add any.
- Audio description beyond saying whether it applies to a live lesson.

## Test plan

A docs spike's tests are checks on its claims:

1. **Clause applicability** is quoted from the standard and from W3C Understanding 1.2.4,
   with version and section, never paraphrased from memory.
2. **Every code claim** in the ADR cites a file at a named SHA. The plan re-runs each
   `git grep` and records the result.
3. **Claims-to-evidence map:** each sentence of the draft statement maps to a D3-table row
   or to a stated gap. A sentence with no row is cut.
4. **Disclosure rule** (`rch-d-security-disclosure`): the ADR and the draft describe
   controls and stated gaps only, and add nothing beyond what `ISSUES.md` says publicly.
   No entity details.
5. **Relative links** in the ADR, the ADR-0040 marker and the ISSUES edit resolve.
6. `gitleaks-range.sh` over the unit's range is CLEAN.

No e2e: no user-facing behaviour (D3). The statement page's e2e is `rch-mkt-legal-pages`'s
("Footer links and versions in both locales").

## Open questions

- **`lb-dec-en301549`** (owner, during-build). The ADR is how it is asked. Recommended:
  state the gap and caption after launch.
- **Programme gap:** this unit's `human_gates` list is empty, but its statement draft needs
  `hg-owner-commit` under `dec-legal-texts`. Counsel review is already batched in
  `rch-mkt-legal-pages`. The conductor should add `hg-owner-commit`.

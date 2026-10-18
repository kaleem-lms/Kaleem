---
number: 0054
title: Live-lesson captions - state the gap, caption after launch, and correct the clause
status: accepted
date: 2026-10-18
decided: 2026-10-18, by the owner, as option 1 of lb-dec-en301549 ("State the gap; captions post-launch")
amends: ADR-0040 (Decision 5)
decision: lb-dec-en301549
---

## Context

ADR-0040 Decision 5 adopted EN 301 549 and called clause 7 "the one clause with real
teeth for kaleem", meaning captions and audio description for live video lessons. It put
the item in `ISSUES.md` under **Blocks launch** and left it unresolved. This ADR does
three things: it checks which clauses actually apply to a live two-person lesson, it
compares the ways a lesson could be captioned and what each costs in privacy, and it
records the position taken for launch. It ships no code.

Everything quoted below was read from the primary source on 2026-10-18. Anything not
read is marked **unverified**.

### What the code does today

Pinned SHAs: dashboard `c70a0f4`, marketing `7415349`, backend `cd9812e` (each
`origin/main` on 2026-10-18). Every claim was re-run with `git grep` at that SHA, with a
positive control (a term known to exist, so an empty result means "absent" and not "broken
command"). The check script is not committed; its results are in the verification log at
the end.

- A call negotiates exactly three media lines, `audio`, `camera`, `screen`
  (`dashboard/src/features/call/usePeerConnection.ts`, `MEDIA_LINES` and `MediaLine`;
  ADR-0039). No source file in `dashboard/src` calls `createDataChannel` or
  `ondatachannel`, so the call has **no path for text of any kind**.
- Nothing in `dashboard/src` mentions captions, transcription or `SpeechRecognition`.
- The dashboard shows whether the other person's microphone is switched off
  (`ParticipantTile.tsx`, `micMuted`). The lobby shows the user's **own** microphone level
  before joining (`Lobby.tsx` `MicLevelMeter`, `useMicLevel.ts`, a Web Audio analyser).
  Nothing in the call room shows the **other** person's audio activity: `useMicLevel` is
  imported only by `Lobby.tsx` (and its tests), no call-room component references it, and
  no component measures the remote track. So there is **no indicator of the other person's
  live audio activity during the call**.
- Media is peer-to-peer or relayed by coturn; signaling (ADR-0035) never carries media.
  The backend call models (`Room`, `CallDiagnostic`) hold no recording, transcript or
  caption field.
- Rooms hold two people. Group calls are deferred (ADR-0034, ADR-0046).
- Marketing `src` mentions neither WCAG, EN 301 549 nor accessibility.

### Which clauses apply to a live two-person lesson

Sources: **EN 301 549 V4.1.1 (2026-09)**, ETSI deliverables directory `04.01.01_60`
(listed 2026-09-02), read in full text; **V3.2.1 (2021-03)**, the version in force when
ADR-0040 was written, for comparison; W3C *Understanding SC 1.2.4 Captions (Live)*, WCAG
2.2 Understanding Docs, "Updated 09 March 2026". That V4.1.1 is the version the
European Commission cites for any presumption of conformity is **unverified**; only the
ETSI directory listing and the document itself were read.

**Clause 7 does not require anyone to create captions.** Quoted from V4.1.1:

> 7.1.1 ... Where ICT displays video with synchronized audio, the ICT shall have a mode
> of operation to display the available subtitles.

and its NOTE 3: "Clause 7.1.1 refers to the ability of the player to display subtitles.
Clauses 9.1.2.2, 10.1.2.2 and 11.1.2.2 refer to the provision of subtitles for the
content". Clause 7.1.3 preserves subtitle data the ICT transmits; 7.2.1 plays "available"
audio description. All of clause 7 is about displaying or preserving what exists.
V3.2.1 reads the same way (it says "captions"; V4.1.1 renamed them "subtitles"). Whether
7.1.1 still asks a player with no captions to have a display "mode of operation" is an
interpretation this ADR does not resolve; kaleem has nothing to display either way.

**Clause 9.1.2.4 points at WCAG 1.2.4, and W3C says a two-way call is not its target.**
V4.1.1: "9.1.2.4 Subtitles (live) ... the web page shall satisfy WCAG 2.2 Success
Criterion 1.2.4 Captions (Live)." V3.2.1 pointed at WCAG 2.1; the criterion text is the
same. The Understanding page quotes the criterion, "Captions are provided for all live
audio content in synchronized media", and says it "is not intended to require that
two-way multimedia calls between two or more individuals through web apps must be
captioned", with responsibility falling to "the callers". The page is guidance, not the
normative criterion, and it does not settle how a tutoring session would be classified by
a regulator; that is for counsel.

**Clause 6 is the clause with teeth, and ADR-0040 missed it.** Clause 6 covers "ICT
supporting real-time bidirectional communication". Its 6.0.2 makes a communication client
meet "all applicable 6.1 and 6.3 to 6.6 requirements", and "where the communication client
is part of a terminal with text handling capabilities, all applicable 6.2 requirements". A
browser is such a terminal. Two requirements follow that kaleem does not meet today:

| Clause (V4.1.1) | Text | kaleem today |
| --- | --- | --- |
| 6.2.1.1 RTT functionality | "Where ICT provides functionality that allows real-time bidirectional voice communication, the ICT shall provide functionality that allows real-time bidirectional RTT communication." RTT is text "perceived by the user as being continuous on a character-by-character basis" (Definitions), with under 1 s delay per the definition's note | **Not met.** No text path in the call at all. Chat (ADR-0050) is message-based, not character-by-character, and is not in the call |
| 6.5.5 Indicator of audio with video | "the ICT shall provide a real-time indicator of audio activity" | **Not met** on the evidence above: no call component shows the remote side's audio activity. The mic-muted indicator reports a switch, not activity, and the lobby meter measures the user's own microphone before joining; the clause's test needs the other person's activity during the call |

Other clause 6 requirements (6.1 voice frequency range, 6.5.2 to 6.5.4 resolution, frame
rate and audio/video sync) were **not examined** by this unit. 6.1.4 (subtitle delay under
2 seconds) is a recommendation that applies only "where ICT provides subtitles".

**Conclusion.** ADR-0040's framing ("clause 7 ... captions and audio description ...
substantial work") was wrong in two ways. First, no clause requires kaleem to produce
captions for a two-person lesson: clause 7 is about display, and W3C reads SC 1.2.4 as
not reaching two-way calls. Second, the obligation that does bind a two-way voice and
video product is **real-time text (6.2.1.1)** plus the **audio-activity indicator
(6.5.5)**. Captions for deaf and hard-of-hearing users remain a real accessibility gap in
user terms; they are simply not what the standard names. Whether any of this binds kaleem
in law (the European Accessibility Act and its exemptions, enforcement bodies) is not
decided here and goes to counsel.

### The options

ADR-0023's four points are given per option, because O2 to O4 each add a new category of
personal data: the voices and transcripts of lessons, many of the speakers children, the
content often recitation of the Quran. Size classes are this ADR's estimates against the
programme's S, M, L sizes, not measurements.

| | Option | What, why, how long, who sees it (ADR-0023) | Touches | Browsers | Arabic and recitation quality | Size |
| --- | --- | --- | --- | --- | --- | --- |
| O1 | No captions or RTT at launch; the gap is stated | No new data | Nothing | n/a | n/a | S, docs only |
| O2 | Each browser recognises its own user's speech and sends the text to the peer | Speech audio goes to the browser vendor's service unless recognition is on-device; the text is shown to the peer and not stored unless we add that; retention to be set | New data-channel line, appended per ADR-0039 (fourth `m=` section); a new capture path in the call client | See below | **Unmeasured** | M |
| O3 | Self-hosted speech-to-text | Two variants. (a) A kaleem server joins the call as a peer to hear it: it must decrypt media, which ends peer-to-peer (ADR-0034). (b) Each browser uploads its own microphone audio to a kaleem service: p2p stays, but kaleem now receives and processes children's voices; retention is a new decision | New service and queue, probably the E5 escape hatch for the compute; a new token purpose on signaling (ADR-0035) | Any browser that can capture audio | **Unmeasured** | L |
| O4 | Third-party captioning or speech-to-text vendor | A new processor receives lesson audio; data processing agreement, children's data and transfer questions go to counsel; retention per contract | Same capture path as O3(b), plus a vendor integration and its own ADR | Any browser that can capture audio | **Unmeasured** | M to L |
| O5 | A human captioner | A third person hears the lesson | A third participant: v1 rooms hold two (ADR-0034, ADR-0046). Feeding audio to a captioner outside the room is O4 with a person at the far end | n/a | Depends on the person | Blocked in v1 |
| O6 | Real-time text between the two people (not captions) | Only what users type; shown to the peer; not stored unless we add that | A data channel carrying character-wise text (ADR-0039 fourth line); UI for send/receive, direction, and speaker identification (6.2.2.x); responsiveness (6.2.4) | Data-channel support per browser **not checked against a primary source here**; Safari/iOS unverifiable in this project | n/a | M |

**Browser coverage for O2**, from MDN's browser-compat-data (`api/SpeechRecognition.json`
on `main`, read 2026-10-18): `SpeechRecognition` unprefixed from Chrome 139 and Edge;
Safari 14.1 under the `webkit` prefix (iOS mirrors Safari); Firefox `preview` only, i.e.
not shipped. `processLocally` is Chrome 139 and Edge; recorded as not supported on Safari
and Chrome Android. MDN states: "On some browsers, like Chrome, using Speech Recognition
on a web page involves a server-based recognition engine. Your audio is sent to a web
service for recognition processing", and that on-device mode "ensures that neither the
audio nor the transcribed speech are sent to a third-party service". Where Safari sends
audio, and which microphone track the browser listens to (the call's own or a second
capture), are **unverified**: no Apple documentation was read. Safari and iOS cannot be
verified in this project in any case (no Apple device; ADR-0040, C3e). Whether the
language packs for Arabic exist on-device, and how well any engine recognises Quranic
recitation (tajweed, vowelled text), is **unmeasured** for every option, and no prototype
was built.

### Mapping to `lb-dec-en301549`

"State the gap; captions post-launch" is O1. "Build now" is O2, O3 or O4 (and/or O6).
"WCAG claim only" would drop the EN 301 549 claim and keep the gap.

## Decision

**1. Position for launch: O1.** The live lesson has no captions and no real-time text at
launch, and the accessibility statement says so in those words. Captioning and RTT are
built after launch, in their own spec and unit.

**2. The statement names the gaps by their real clauses,** not by ADR-0040's "clause 7":
no real-time text (EN 301 549 6.2.1.1), no audio-activity indicator (6.5.5), no captions
(not a clause requirement, stated because deaf and hard-of-hearing users are affected),
and Safari and iOS unverified. The captions gap is the owner's answer; the other two are
added because the primary sources put them ahead of captions, and a statement that named
only captions would understate the gap.

**3. Recommended order after launch (a recommendation, not a decision; the owner
orders it):** the audio-activity indicator first, because it is the smallest and is a
"shall" (`useMicLevel` already measures a stream's level in the lobby and could be pointed
at the remote stream; not prototyped here); then O6 shaped as true RTT, because it is the clause that binds, adds no new
category of personal data and keeps the call peer-to-peer; then captions through O2 only
on-device, or O4 behind its own ADR, because every captioning route that sends children's
audio off the device needs a processor decision first. O3(a) is rejected outright: it
ends peer-to-peer. O5 waits for group calls.

**4. ADR-0040 is amended, not rewritten:** a marker on Decision 5 points here. The
EN 301 549 adoption stands; what changes is which clause is called load-bearing.

**5. The draft accessibility statement** is written under `dec-legal-texts`: the agent
drafts, counsel approves, the owner commits. It lives at
`docs/decisions/2026-10-18-accessibility-statement-draft.md` and is **not committed by
this unit**. Every factual sentence in it maps to a gate in the CLAUDE.md D3 table or to a
stated gap, per the table below. Publication is `rch-mkt-legal-pages`, after counsel.

## Claims to evidence

A sentence without a row is cut from the statement. Row ids are used in the draft.

| Id | Statement sentence (short form) | Evidence |
| --- | --- | --- |
| S1 | The statement covers the marketing site and the dashboard | Scope, not a claim |
| S2 | We aim for WCAG 2.2 level AA | ADR-0020 baseline; ADR-0040 |
| S3 | We are partially conformant | Follows from G1 to G4 |
| G1 | Live lessons have no captions | Code claim above (grep at `c70a0f4`) |
| G2 | Live lessons have no real-time text | Code claim above; EN 301 549 V4.1.1 6.2.1.1 |
| G3 | Live lessons have no indicator of the other person's audio activity | Code claim above (lobby meter present, call room has none, checked at `c70a0f4`); 6.5.5 |
| G4 | We have not tested kaleem in Safari on a Mac, or in any browser on an iPhone or iPad | D3 rows `call diagnostics (C3e-a)` and `browser hardening (C3e-b)`; backed by B1 |
| B1 | The automated checks run in Chromium, the engine behind Chrome and Edge | `dashboard/playwright.config.ts` at `c70a0f4` has one project, `chromium` ("Chromium only") |
| E1 | Colour contrast is checked as rendered in a real browser, light and dark, both reading directions, on the design preview | D3 row `design-system - rendered contrast` |
| E2 | The four sign-in routes are checked in both themes | D3 row `identity - rendered contrast` |
| E3 | Every enabled control on the preview accepts a 24 by 24 pixel pointer; the sign-in routes are swept the same way | D3 row `design-system - target size` |
| E4 | Five signed-in pages are checked for sideways scrolling at 320, 360 and 430 px | D3 row `dashboard - reflow (1.4.10)` |
| E5 | On a phone held upright the call controls are at least 44 px and on screen | D3 row `call fixes (C5)` |
| E6 | The side menu on a phone closes with Escape and returns focus | D3 row `app shell` |
| E7 | The in-call microphone and camera buttons have one stable name, with state exposed separately from the name | D3 note on C6 |
| E8 | A nightly Lighthouse run audits the marketing home and the dashboard sign-in page in the default theme only | D3 table, security and performance scanning |
| N1 | The checks are automated and the statement makes no claim about manual assistive-technology testing | A stated limit: no D3 row |
| N2 | Marketing has no automated test suite at the time of writing | D3 coverage table (`marketing`: no suite); recheck at publication |
| P1 | Entity, contact address, enforcement route | Placeholders; `hg-legal-entity`, counsel |

## Alternatives considered

- **Build now (O2, O3, O4, and/or O6 before launch).** Rejected for launch: it grows the
  unit past S into a feature with a new data category, a data-channel contract change
  (ADR-0039), and for O2 to O4 a processor decision, with Arabic quality unmeasured and
  Safari unverifiable here. The owner's answer was to caption after launch.
- **A WCAG claim only, dropping EN 301 549.** Rejected. It would not make the gap
  disappear, only stop naming it, and the gap would still exist on clause 6 grounds.
- **Keep ADR-0040's framing and say "clause 7".** Rejected: it is checkably wrong against
  the standard's text, and a public statement that cites the wrong clause is the failure
  ADR-0040 itself warned about.
- **Treat the W3C Understanding note as settling that nothing is owed.** Rejected: it is
  informative guidance on one success criterion, and it says nothing about clause 6.

## Consequences

**Good**

- The launch position is written down and checkable, and the statement cannot claim more
  than a gate or a stated gap supports.
- The real obligation (RTT, audio-activity) is on the record before launch, not found
  later by someone reading clause 6.
- No code, no data, no dependency, no migration. The blue-green window is unaffected.

**Bad / costs**

- "Partially conformant" is a visible public statement about children's learning
  software, and it names two clause-level gaps where ADR-0040 had named one.
- The gap list may be incomplete: clause 6 beyond 6.2.1.1 and 6.5.5, and clauses 4 and 5,
  were not examined, and Safari and iOS are unverifiable in this project.
- The post-launch order is a recommendation; until the owner allocates the unit, the
  gaps stay open.
- Whether a statement is legally required, whether an exemption applies, and which body
  enforces it are unanswered here and are listed for counsel in the draft.

## Verification log

Run 2026-10-18 against the pinned SHAs above, positive controls first. Dashboard: no
`caption`, `transcri`, `SpeechRecognition`, `createDataChannel`, `ondatachannel` in `src`
(control `addTransceiver` found). A first version of the audio-activity search used only
`audioLevel`, `AnalyserNode`, `isSpeaking`, `voice activity` and wrongly reported nothing;
review found `createAnalyser` in `useMicLevel.ts`. The corrected check also searches
`createAnalyser`, `useMicLevel`, `MicLevelMeter`, has a positive control (it must find
`useMicLevel`), and asserts the non-test importers of `useMicLevel` are exactly
`Lobby.tsx`. `MEDIA_LINES` entries: `audio`, `camera`, `screen`, and
the `MediaLine` type matches. Marketing: no `wcag`, `301 549`, `accessib` in `src`
(control found). Backend: no `recording`, `transcript`, `caption` in
`kaleem/scheduling/models.py` (control `Room`, `CallDiagnostic` found). Dashboard: no
`audioLevel`, `isSpeaking`, `voice activity` in `src`; `createAnalyser`, `useMicLevel` and
`MicLevelMeter` appear only in `Lobby.tsx`, `useMicLevel.ts` and their tests, and no
call-room component (`CallRoom.tsx`, `ParticipantTile.tsx`, `VideoTile.tsx`) references
them. `dashboard/playwright.config.ts` declares one project, `chromium`.

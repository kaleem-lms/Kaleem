# kaleem brand brief

> **Drafted by the conductor (2026-10-25), owner to review.** The owner delegated this
> rewrite ("do it yourself") after rejecting four exploration rounds (15 directions) that
> were judged against the previous version. It is written from the product as it ships, not
> from inference. Spec: `docs/superpowers/specs/2026-10-25-inf-brand-brief-rewrite-design.md`.
> This is a brief, not a direction: it picks no mark, composition or typeface. The root
> `brand/` package (June 2026, the pre-ADR-0040 v0.1.1 palette) is **not an input**.

## Who this is for

kaleem teaches non-Arabic speakers Quran, Tafsir and the Arabic language with a live teacher.
Four people meet the brand:

- **The child learner**, whose parent created the account and manages it. The child sees the
  mark every lesson and should find it friendly, not solemn.
- **The adult learner**, who enrols for themselves.
- **The parent**, who pays monthly and decides. They are handing over a child and a card, and
  many are conservative about who teaches their child.
- **The teacher**, who is the other side of the market and sees the same brand.

There are two readerships of the Arabic, and both are first-class:

- **A non-reader of Arabic** (most learners, many parents) meets كليم as a *shape*. It must be
  recognisable, memorable and distinct at a glance, without being read.
- **An Arabic reader** (every teacher, and some parents and learners) meets كليم as a *word*.
  It must read correctly, and a calligrapher or a native speaker must not wince.

The dashboard ships a full Arabic locale with right-to-left layout. The brand is therefore
used in both directions, from day one.

## Voice

The product speaks in a calm second person, in plain words, without hype: "Start learning with
kaleem." The Latin name is written lowercase, "kaleem", and today's shell sets it as a Fraunces
wordmark followed by an accent-coloured full stop. That is a placeholder, not a brand decision.
The Arabic copy uses the same register and writes the name with vowel marks, كَلِيم. The mark
speaks the same way: quietly, with nothing to prove.

## Values

Each value is something the mark should carry, with the product fact behind it.

- **Trust.** Parents add children, teachers are matched to a family's criteria (including
  teacher gender), both sides rate each other, and teachers send session reports. The mark
  should look like it keeps its word.
- **Rootedness.** The subject matter is Islamic scholarship, taught by people who carry it. The
  mark should belong to that tradition's own craft, not borrow its symbols.
- **Clarity.** Learners start from zero. The brand should feel like a clear path.
- **Respect for both scripts.** Arabic is the root of the product, and English is how most
  learners enter. Neither is the translation of the other.
- **Access.** WCAG 2.2 AA and EN 301 549 are a baseline across the product (ADR-0020,
  ADR-0040). A brand that only works for some eyes fails this one.

## What the mark must say

Trustworthy enough to hand a child and a monthly payment to. Rooted in Islamic scholarly
tradition without being austere or clerical. Modern enough to sit in a software product next
to a video call. Warm enough for a child, serious enough for a parent.

## What it must not say

- Not a mosque logo. Not a government ministry. Not a generic edtech startup. Not a novelty
  "Arabian" pastiche.
- None of the category's four clichés, found by research in round 4: an **open book with wifi
  arcs**, a **minaret with a laptop** (two objects stapled together, not one idea), a
  **green-to-gold gradient**, and **Montserrat** as the default geometric sans.
- **No Quranic text, divine names or depicted mushaf in the mark.** A mark is printed on
  merchandise, cropped to an avatar, shrunk to a tab and thrown away. Sacred text must not
  meet that life, and a name in a logo can be misread by a reader.

## Hard constraints

- The mark is كليم, Arabic-first, calligraphic.
- Colour comes from the ADR-0040 palette. The mark does not get new colours.
- Must read at 16px and crop to a square.
- Must have an RTL and an LTR lockup.
- Latin "kaleem" is lowercase, matching the existing product voice.
- Letterforms come from an OFL-licensed typeface's outlines, never from a generated image.
- The source SVGs use `currentColor` only (ADR-0043); colour is bound by token alias.

## The mark and the type in both scripts

**The Arabic mark** has to serve both readerships. For a reader, كليم must read as كليم
whatever the stylisation, with the letters in the right order and the joins intact. For a
non-reader, the whole word must also be a single, memorable silhouette, since that is all they
will keep. The two goals meet when the form is simple enough to hold as a shape and honest
enough to read as a word.

**The Latin wordmark** is lowercase "kaleem". In the LTR lockup it sits with the Arabic; in the
RTL lockup the order follows the reading direction. Neither lockup is the other with the order flipped by
default; each is judged on its own.

**The outlines** of the Arabic come from an OFL face chosen under `dec-brand-typeface`. Faces
named in earlier rounds are *candidates* only. This brief names no winner.

**The display type has an open gap.** The product's tokens ship Fraunces (display), Inter
(sans) and IBM Plex Sans Arabic (Arabic). Fraunces has no Arabic, so Arabic display headings
fall back to the platform's generic serif (`ISSUES.md`). Whatever the mark chooses, the brand
needs an Arabic companion for the display role, and `dec-brand-typeface` must settle it.

## Accessibility

- The baseline is **WCAG 2.2 AA** plus **EN 301 549** (ADR-0020, ADR-0040).
- The mark has an **accessible name** in each locale: `kaleem` in English, and in Arabic the reading the owner settles (For the owner's review, item 1), matching the visible mark.
  Where it is decorative next to the product name, it is hidden from assistive technology.
- Every mark-on-surface pair is **declared in `contrast-pairs.json`** and passes in **both
  themes**, light and dark. The mark's colours are token aliases (`brand.json`:
  `{primary-text}` on `{background}`, and the reverse), never literals.
- The mark survives **monochrome**, and it never relies on colour alone to be understood.
- It holds at **16px and 32px**, and under forced-colours and high-contrast modes.

## How we will know it worked

The owner answers each question per artboard. A rejection names the line it failed, so the
next round can fix it.

- Does an Arabic reader see كليم and read كليم, with no hesitation? (Hard constraints, The mark
  and the type.)
- Does a non-reader recognise the brand from its shape alone, and tell it from its neighbours
  at 16px? (Hard constraints.)
- Would a conservative parent hand this brand a child and a monthly payment? (What the mark
  must say, Values.)
- Would a child find it friendly, and a teacher find it dignified? (Who this is for.)
- Is any of the four clichés, or any sacred text, present or implied? (What it must not say.)
- Does the RTL lockup stand on its own, rather than being a flipped LTR? (The mark and the
  type.)
- Does it pass as a declared pair in both themes, and in monochrome? (Accessibility.)

## For the owner's review

Two points this draft lists and does not decide:

1. **Which reading of the name the mark carries.** The bare كليم (the hard constraint's
   spelling) or the vocalised كَلِيم, as the Arabic UI writes it.
2. **The name's meaning as a direction resource.** The Arabic root of كليم relates to speech,
   so one who speaks or converses. Whether the name carries a further religious sense, and
   whether a direction may draw on it, is for the owner to confirm; this draft does not assert
   it. Earlier rounds also drew on the qalam (the reed pen) as the tradition's symbol of
   knowledge. It is a resource, not a requirement.

If the review drops or changes a hard constraint, the brand spec and plan are amended in the
same PR.

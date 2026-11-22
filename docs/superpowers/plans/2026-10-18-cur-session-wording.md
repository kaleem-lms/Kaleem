---
spec: docs/superpowers/specs/2026-10-18-cur-session-wording-design.md
status: draft
---

Repo: `dashboard` only. Branch `feat/cur-session-wording` in the worktree
`/home/abdulkhalek/Projects/kaleem-worktrees/dashboard-cur-session-wording`, created from
`origin/main` (9d21e01 at writing) as runbook section 1 says. There are no migrations, no
dependency changes and no floor edits.

## Steps

1. [x] **Worktree.** Create the worktree and run `pnpm install --frozen-lockfile`.

2. [x] **Make the e2e selectors wording-neutral (commit 1, `test(e2e): …`).** These selectors
   must pass against the current copy and the new copy alike.
   - `e2e/call.spec.ts` 173–193:
     - Trigger: `page.getByTestId("call-controls").getByRole("button", { name: /^leave\b/i })`.
       The dialog is portalled outside `call-controls`, so the scope keeps the trigger unique.
     - Heading: `dialog.getByRole("heading")`.
     - Stay: `dialog.getByRole("button", { name: /^stay\b/i })`.
     - Confirm: `dialog.getByRole("button", { name: /^leave\b/i })`.
   - `e2e/call-ui.spec.ts` 1244: `/leave lesson/i` becomes `/^leave\b/i`. The dialog is closed at
     that point, so it matches one button.
   - `e2e/booking.spec.ts` 128: `/show .* past lesson/i` becomes `/^show \d+ past\b/i`.
   - `e2e/booking.spec.ts` 154: hoist `/sessions this cycle/i` into one file-level locator helper.
     Add `await expect(<helper>(page)).toBeVisible()` to the first flow ("a student sees the
     sessions generated…"), where the booked student has a quota card. Keep the teacher's
     `toHaveCount(0)` on the same helper. (As built: the helper is anchored,
     `/^sessions this cycle$/i`, because a used-up cycle also renders "...your sessions this
     cycle" in the reset line and an unanchored match would be two elements.)

3. [x] **Red: the terminology guard.** Add `src/locales/terminology.test.ts`. It imports both
   `common.json` files and walks the `call`, `booking` and `prefs` subtrees.
   - It expects no `en` value to match `/\blessons?\b/i`.
   - It expects no `ar` value to contain `درس` or `دروس`.
   - Positive controls: `modules.curriculum.description` matches in both locales, and the walker
     visits more than 0 values per namespace.
   - Run `_tools/dashboard-gate.sh <wt> src/locales/terminology.test.ts`. It must be red, naming
     27 `en` and 30 `ar` offenders.

4. [x] **Red: the unit tests move to the new copy.**

   | File | Change |
   | --- | --- |
   | `JoinButton.test.tsx` | 121 becomes `/^Join session: Quran on .+/` |
   | `SessionList.test.tsx` | every `/… past lesson(s)/i` becomes `/… past session(s)/i` (403–552) |
   | `CallControls.test.tsx` | 105–349: `leave session`, `the session keeps running`, `stay in the session` |
   | `CallRoom.test.tsx` | 349 becomes `/already in this session/i`; 708–742 become `/leave session/i` |
   | `Lobby.test.tsx` | 422 becomes `/get ready for your session/i` |
   | `routes/_call/sessions.$sessionId.room.test.tsx` | 260 becomes `/session room/i`. A bare `/session/i` would also match the lobby's h2. |

   In `SessionList.test.tsx`, define one `const pastToggle = { name: /past session/i }`. Use it
   in the three negative checks (436, 468, 516). Add `expect(screen.getByRole("button",
   pastToggle)).toBeInTheDocument()` to "treats a scheduled lesson that already ended as past",
   so that locator is proven to match something.

   Leave alone: the stub label "Leave lesson" in the room-route test (117) and
   `CallControlButton.test.tsx`'s literal `label` prop. Neither reads the locale.

   Run the six files. They must be red against the current copy.

5. [x] **Green: the locale edit (commit 2, `fix(i18n): call live sessions "session", not
   "lesson"`).** Edit only the values below, keep tab indentation, and rename no keys.

   **English.** Make one swap in each value, `lesson` to `session` and `lessons` to `sessions`.
   Change nothing else in the string.
   - `prefs.genderDesc.male` / `.female`
   - `booking.join`, `joinFor`, `joinNotOpen`, `joinError`, `pastHeading`, `showPast_one`,
     `showPast_other`, `hidePast`, `emptyDescription`
   - all 16 `call.*` keys the spec lists

   **Arabic.** The feminine جلسة changes agreement, so the full values are listed:

   | Key | New `ar` value |
   | --- | --- |
   | `prefs.genderDesc.male` | جلسات مع معلّم ذكر. |
   | `prefs.genderDesc.female` | جلسات مع معلّمة أنثى. |
   | `booking.join` | انضم إلى الجلسة |
   | `booking.joinFor` | انضم إلى الجلسة: {{subject}} في {{date}} |
   | `booking.joinNotOpen` | لم تُفتح غرفة هذه الجلسة بعد. |
   | `booking.joinError` | تعذّر الانضمام إلى الجلسة. يرجى المحاولة مرة أخرى. |
   | `booking.pastHeading` | الجلسات السابقة |
   | `booking.showPast_one` | عرض جلسة سابقة واحدة |
   | `booking.showPast_two` | عرض جلستين سابقتين |
   | `booking.showPast_few` | عرض {{count}} جلسات سابقة |
   | `booking.showPast_many` | عرض {{count}} جلسة سابقة |
   | `booking.showPast_other` | عرض {{count}} جلسة سابقة |
   | `booking.hidePast` | إخفاء الجلسات السابقة |
   | `booking.emptyDescription` | بمجرد حجز موعدك الأسبوعي، ستظهر هنا كل الجلسات الناتجة عنه. |
   | `call.roomHeading` | غرفة الجلسة |
   | `call.lobbyTitle` | استعد لجلستك |
   | `call.leave` / `call.leaveConfirm` | مغادرة الجلسة |
   | `call.stateReconnectingStudent` | جارٍ إعادة توصيلك بجلستك… |
   | `call.roomFull` | يوجد بالفعل شخصان في هذه الجلسة. لا يمكن لأكثر من طالب ومعلم واحد الانضمام في الوقت نفسه. |
   | `call.replacedElsewhere` | لقد انضممت إلى هذه الجلسة من علامة تبويب أخرى. |
   | `call.linkExpired` | انتهت صلاحية رابط هذه الجلسة. انضم مرة أخرى من جدولك. |
   | `call.connectionLostTitle` | انقطع الاتصال بخادم الجلسة |
   | `call.deviceCheckBody` | the current value, with الدرس replaced by الجلسة |
   | `call.leaveTitle` | مغادرة هذه الجلسة؟ |
   | `call.leaveBody` | ستستمر الجلسة بدونك. يمكنك الانضمام مجددًا من جدولك ما دامت الجلسة قائمة. |
   | `call.leaveStay` | البقاء في الجلسة |
   | `call.shareUnsupportedHelp` | متصفحك لا يوفّر مشاركة الشاشة. بقية أجزاء الجلسة تعمل بشكل طبيعي. |
   | `call.replacedElsewhereHelp` | تعمل هذه الجلسة الآن في علامة التبويب الأخرى. تابع هناك، أو انضم من جديد من جدولك. |
   | `call.joinFailedTitle` | تعذّر فتح هذه الجلسة |

   Re-run steps 3 and 4. All seven files must be green.

6. [x] **Mutation checks.** Revert each fix, see red, then restore it.
   - Set `en` `call.leave` back to "Leave lesson". `terminology.test.ts` and
     `CallControls.test.tsx` both go red.
   - Set one `ar` `call.*` value back to الدرس. `terminology.test.ts` goes red.
   - Rename `modules` to `xmodules` in the test's lookup. The positive control goes red.
   - In a scratch edit, change `en` `booking.showPast_one` so it no longer says "past session".
     The new `pastToggle` positive assertion goes red. The three negative checks stay green, which
     is exactly why the positive control is needed.
   - Record each failure line for the hand-back block.

7. [x] **Full gate.** Run `_tools/dashboard-gate.sh <wt>` for tsc, lint, `test:coverage
   --maxWorkers=6`, build and the built-CSS check. Coverage should not move, because no `.ts`
   logic changed. If it drops, stop: floors are not edited (`dec-floor-ownership`).

8. [ ] **e2e (optional locally; CI is the authority; not run locally, left to CI).** If a port slot is free, run
   `booking.spec.ts`, `call.spec.ts` and `call-ui.spec.ts` twice: once at commit 1 (old copy) and
   once at commit 2 (new copy). Both runs must be green, which is the wording-neutrality proof.
   For the booking positive control, also run once with `booking.quotaTitle` changed in a scratch
   build and see it go red. Known local-only failures (`call.spec.ts:207`, touch-targets `/login`)
   are not this unit's.

9. [x] **Hand back** per runbook section 3: the tree is clean, origin/main is contained,
   `gitleaks-range.sh` is clean, the floor grep is empty, and the mutation lines are included.

## Risks

- **Shared file `e2e/call.spec.ts`.** `ci-fix-known-flakes` edits the same file around line 207,
  a different region. The later lander merges `origin/main` (a merge, never a rebase) and
  re-runs the gates.
- **Other units writing `call`/`booking`/`prefs` copy in parallel.** Their keys may conflict in
  `common.json`. The programme orders this unit first, and the conductor resolves locale
  conflicts by script at freshness.
- **A regex that matches too much.** `/^leave\b/i` in `call-ui.spec.ts` goes through
  `getByRole(...).boundingBox()`, which fails in strict mode on two matches. That would be red,
  not a silent pass, and scoping to `call-controls-bar` is the fallback.
- **Arabic wording.** The plural agreement follows the app's existing `quotaRemaining_*`
  pattern. The owner reads it in the wave-1 Arabic batch, which does not gate the merge. Any
  correction arrives as a copy follow-up.

## Verification

- **Per step:** focused `dashboard-gate.sh` runs, red before the change and green after.
- **Whole unit:** the full dashboard gate is green; CI's `dashboard-lint`, `dashboard-build` and
  `e2e` are green, with the log read for `booking`, `call` and `call-ui` flow names.
- **Staging (step 11, `dec-d9-substitute`):** an agent click-through on `/schedule`, the lobby,
  the call and the leave dialog, in both themes, Arabic RTL and at 320px, showing the new noun
  with nothing truncated or overflowing.

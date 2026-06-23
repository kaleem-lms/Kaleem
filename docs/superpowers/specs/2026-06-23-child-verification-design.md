# Child verification & login model — design

**Status:** approved (design discussed + approved 2026-06-23; user chose real-email+verification, both password paths).
**Date:** 2026-06-23

## Goal

Give a parent-created child a **real, verifiable login identity** so the child can actually
sign in and the parent can manage them. Today `create_child` uses a placeholder email
(`child.<uuid>@placeholder.kaleem`) + unusable password — the child cannot log in (ISSUES).
This makes "child verified → parent can set password / edit preferences" real.

## Decisions (from brainstorm)

- **Login identity = a real email** the *parent provides*; the child verifies it like an adult.
  Login is email + password (unchanged auth).
- **Two password paths, parent's choice per child:**
  - **Parent sets an initial password** at creation → child verifies email → logs in with it.
  - **Parent leaves it blank** → child gets a "set your password" link → sets their own; that
    link also verifies the email.
- **"Verified"** = the child's `EmailAddress.verified` is true (same meaning as adults).

## Reuse-first architecture (minimal new surface)

Almost everything already exists — verify-email (email slice) and the reset-password
uid+token flow (slice 4). The design leans on them:

- **Parent-set-password path:** `create_child(email, password)` → standard allauth
  verification email (`/verify-email?key=…`) → child verifies → logs in with email + the
  parent-set password. *Pure reuse of verify-email.*
- **Child-set-password path:** `create_child(email, password=None)` → child gets a
  reset-style email linking to the **existing** `/reset-password?uid=&token=` page → child
  sets their password there. **`confirm_password_reset` is extended to also mark the user's
  primary `EmailAddress` verified** — safe for adults (their email is already verified, so it's
  a no-op; `request_password_reset` only ever emails verified addresses) and it activates the
  child. So a child who sets a password via the link is verified in the same step. *Reuses the
  slice-4 page + endpoint + a one-line verify addition.*

The only genuinely new backend behavior is in `create_child` and the parent-management
actions; no new frontend token pages.

## Backend

`kaleem.identity`, services in `services.py`, `is_parent_of` authorization on every
parent-manages-child action.

1. **`create_child(parent_user_id, full_name, email, password=None, preferences)`**
   - Validate `email` is unique (same checks as `register_user`: not on any `User`/`EmailAddress`).
   - Create the child `User` with the **real** email; set `password` if given, else unusable.
   - Create `EmailAddress(verified=False, primary=True)`, `StudentProfile`, `ParentStudent`.
   - **Trigger activation:** if a password was set → send the allauth verification email;
     if not → generate `default_token_generator` uid+token and email a "set your password"
     link to `{FRONTEND_URL}/reset-password?uid=&token=`.
   - Remove the `_placeholder_child_email()` path for new children (kept only for any legacy
     rows until they're migrated via "change email").
2. **`confirm_password_reset(...)`** — after setting the password, mark the user's primary
   `EmailAddress.verified = True` (activates the child; no-op for adults).
3. **`set_child_email(parent_user_id, student_profile_id, email)`** — parent sets/changes a
   child's email (also migrates legacy placeholder children). Uniqueness-checked; resets
   `verified=False` and re-sends activation (verification or set-password link, depending on
   whether the child has a usable password).
4. **`set_child_preferences(parent_user_id, student_profile_id, time_preferences, teacher_gender)`**
   — the ISSUES "parent edits child prefs" gap. Updates the child's `StudentProfile`.
5. **`resend_child_verification(parent_user_id, student_profile_id)`** — re-send activation for
   a pending child.
6. **Endpoints (all parent-gated):** extend `children/` POST (create) with `email` + optional
   `password`; `children/<id>/email/`, `children/<id>/preferences/`,
   `children/<id>/resend-verification/`. `set-password` already exists.
   `GET children/` returns each child's `email` + `verified` so the dashboard can render state.

## Dashboard

- **AddChildForm:** add **email** (required) + **password** (optional, "leave blank to let
  your child set it") fields.
- **/family ChildrenCard:** per child show **Verified / Pending** badge + email; actions:
  set password (exists), **edit preferences** (new — reuse the StudentPreferences form
  fields), **change email**, **resend verification** (when pending). Success → toast.
- **Child login** already works once verified (no change).

## Privacy / GDPR-K

The parent provides + consents to the child's email at creation (parental consent for a
minor's contact data). Birthdate (slice 3) records age. The child's email is the only new PII;
never shown to other users, never echoed in emails beyond the recipient's own (ADR-0023).
Deeper age-gating / consent records remain deferred (ISSUES).

## Testing

- **Backend:** create child with email+password (verification sent, login after verify);
  create child without password (set-password link sent, child sets pw → email auto-verified →
  login); email uniqueness rejected; `confirm_password_reset` verifies the primary email;
  parent-manage actions authorized (non-parent → 404/forbidden); change-email re-verifies;
  edit-preferences persists. 100% line+branch; ruff/mypy/import-linter.
- **Dashboard:** AddChildForm sends email + optional password; /family shows verified/pending
  + actions; edit-preferences submits; jest-axe; en+ar.

## Out of scope

- Username/handle login (we chose email). Magic-link login.
- Age-gating / minor-consent records beyond storing email+birthdate (ISSUES).
- Bulk migration of legacy placeholder children (handled per-child via "change email").
- Children managing their own sub-accounts; multi-parent per child.

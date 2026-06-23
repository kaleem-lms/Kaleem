# Child verification & login model — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax.

**Goal:** Parent-created children get a real, verifiable email (parent-provided) + can log in; the parent manages the child's email / password / preferences from /family.

**Architecture:** Backend (`kaleem.identity`) reuses allauth verify-email + the slice-4 reset-token flow; `create_child` gains email + optional password; `confirm_password_reset` also verifies the primary email (activates a child, no-op for adults). Dashboard updates AddChildForm + /family. Spec: `docs/superpowers/specs/2026-06-23-child-verification-design.md`.

**Tech Stack:** Django 5 / DRF / allauth / pytest-django; React 19 / TanStack / react-hook-form / zod / vitest.

## Global Constraints

- Backend 100% line+branch; ruff + mypy + import-linter; logic in `services.py`; parent actions gated by `is_parent_of`.
- New-password min length 8; child email unique (same checks as `register_user`).
- Reset/confirm emails: URL on its own line, no trailing punctuation (ADR-0023).
- Dashboard: en+ar parity, jest-axe, tsc + biome; success → toast; errors inline.
- Run backend tests with `DATABASE_URL=postgres://kaleem:kaleem@localhost:5432/kaleem … --create-db`.

---

### Task 1: `confirm_password_reset` also verifies the primary email

**Files:** Modify `backend/kaleem/identity/services.py` (`confirm_password_reset`); Test `backend/kaleem/identity/tests/test_password_management.py`.

**Interfaces:** Produces: unchanged signature `confirm_password_reset(uid, token, new_password) -> User`; side effect now also marks the user's primary `EmailAddress.verified = True`.

- [ ] **Step 1: failing test** — add to `TestPasswordReset`:

```python
    def test_confirm_verifies_the_primary_email(self, api):
        user = _user()  # unverified, no EmailAddress yet
        from allauth.account.models import EmailAddress

        ea = EmailAddress.objects.create(
            user=user, email="u@example.com", primary=True, verified=False
        )
        from django.contrib.auth.tokens import default_token_generator
        from django.utils.encoding import force_bytes
        from django.utils.http import urlsafe_base64_encode

        uid = urlsafe_base64_encode(force_bytes(user.pk))
        token = default_token_generator.make_token(user)
        resp = api.post(
            self.CONFIRM,
            {"uid": uid, "token": token, "new_password": "brand-new-pw"},
            format="json",
        )
        assert resp.status_code == 200, resp.data
        ea.refresh_from_db()
        assert ea.verified is True
```

- [ ] **Step 2:** run → FAIL (email stays unverified).

- [ ] **Step 3:** in `confirm_password_reset`, after `user.save(update_fields=["password"])` and before `return user`, add:

```python
    EmailAddress.objects.filter(user=user, primary=True).update(verified=True)
```

- [ ] **Step 4:** run → PASS. Full `test_password_management.py` green.

- [ ] **Step 5:** commit `feat(identity): verify primary email on password-reset confirm`.

---

### Task 2: `create_child` takes a real email + optional password + sends activation

**Files:** Modify `backend/kaleem/identity/services.py` (`create_child`, + a private `_send_child_set_password_link`); `backend/kaleem/identity/api/serializers.py` (`ChildCreateSerializer`); `backend/kaleem/identity/api/views.py` (`ChildListCreateView.post` + GET); Test `backend/kaleem/identity/tests/test_children.py` (find the existing children test module; if child tests live in `test_family.py`/`test_api_children.py`, extend that file instead).

**Interfaces:**
- Consumes: allauth `EmailAddress`, `User.objects.normalize_email`, `default_token_generator`, `urlsafe_base64_encode`, `force_bytes`, `send_email_message`, `settings.FRONTEND_URL` (all already imported in services.py).
- Produces: `create_child(parent_user_id, full_name, email, password=None, preferences=None) -> StudentProfile`. `ChildCreateSerializer` requires `email`, optional `password` (min 8). GET `children/` items gain `email` + `verified`.

- [ ] **Step 1: failing tests** — for: (a) create child with email+password → child User has that email, an unverified EmailAddress, a usable password, and a verification email is sent (mandatory-verification settings fixture); (b) create child with email, no password → a "set your password" email is sent containing `/reset-password?uid=`; (c) duplicate email → 400; (d) GET children includes `email` + `verified`. Mirror the existing children-test patterns + `mailoutbox`/`mandatory_verification` fixtures from `test_api_auth.py`.

- [ ] **Step 2:** run → FAIL.

- [ ] **Step 3: serializer** — `ChildCreateSerializer` gains:

```python
    email = serializers.EmailField()
    password = serializers.CharField(write_only=True, min_length=8, required=False)
```

- [ ] **Step 4: service** — rewrite `create_child`:

```python
@transaction.atomic
def create_child(
    parent_user_id: int,
    full_name: str,
    email: str,
    password: str | None = None,
    preferences: dict | None = None,
) -> StudentProfile:
    """Create a child with a real (parent-provided) email + StudentProfile + link.

    Sends an activation email: the standard verification link when the parent set a
    password, or a 'set your password' link (which also verifies the email on use)
    when they didn't.
    """
    parent = get_parent_profile(parent_user_id)
    if parent is None:
        raise ValidationError("User is not a parent.", field="parent")
    preferences = preferences or {}
    normalized = User.objects.normalize_email(email)
    if (
        User.objects.filter(email__iexact=normalized).exists()
        or EmailAddress.objects.filter(email__iexact=normalized).exists()
    ):
        raise ValidationError("This email is already in use.", field="email")

    child_user = User.objects.create_user(email=normalized, password=password)
    child_user.full_name = full_name
    child_user.save(update_fields=["full_name"])
    EmailAddress.objects.create(
        user=child_user, email=normalized, primary=True, verified=False
    )
    student = StudentProfile.objects.create(
        user=child_user,
        time_preferences=preferences.get("time_preferences", []),
        teacher_gender_preference=preferences.get(
            "teacher_gender_preference",
            StudentProfile.GenderPreference.NO_PREFERENCE,
        ),
    )
    ParentStudent.objects.create(parent=parent, student=student)
    _send_child_activation(child_user, has_password=password is not None)
    return student


def _send_child_activation(child_user: User, *, has_password: bool) -> None:
    if has_password:
        EmailAddress.objects.get(user=child_user, primary=True).send_confirmation()
        return
    _send_child_set_password_link(child_user)


def _send_child_set_password_link(child_user: User) -> None:
    uid = urlsafe_base64_encode(force_bytes(child_user.pk))
    token = default_token_generator.make_token(child_user)
    link = f"{settings.FRONTEND_URL}/reset-password?uid={uid}&token={token}"
    send_email_message.delay(
        subject="Set your kaleem password",
        body=(
            "An account was created for you on kaleem. Set your password to get "
            "started:\n\n"
            f"{link}\n\n"
            "If you weren't expecting this, you can ignore this email."
        ),
        from_email=settings.DEFAULT_FROM_EMAIL,
        to=[child_user.email],
        alternatives=None,
    )
```

Note: `EmailAddress.send_confirmation()` works without a request in recent allauth; if the installed version requires a request, send via the same `send_email_message` pattern instead — the implementer should check `test_api_resend_verification` for how confirmations are triggered and match it.

- [ ] **Step 5: view** — `ChildListCreateView.post` passes `email=data["email"], password=data.get("password")`; GET adds `"email": child.user.email, "verified": <primary EmailAddress.verified>` to each item (fetch verification via `EmailAddress.objects.filter(user=child.user, primary=True).values_list("verified", flat=True).first()` or annotate). Update `ChildResponseSerializer` to add `email` + `verified` (doc).

- [ ] **Step 6:** run → PASS; full identity suite; ruff/mypy/import-linter.

- [ ] **Step 7:** commit `feat(identity): create child with a real email + activation`.

---

### Task 3: parent manages a child's email / preferences / resend

**Files:** Modify `services.py` (`set_child_email`, `set_child_preferences`, `resend_child_verification`); `serializers.py` (small serializers); `api/views.py` + `api/urls.py` (three parent-gated endpoints); Test the children test module.

**Interfaces:** Produces `set_child_email(parent_user_id, student_profile_id, email)`, `set_child_preferences(parent_user_id, student_profile_id, time_preferences, teacher_gender_preference)`, `resend_child_verification(parent_user_id, student_profile_id)` — each raises `NotFoundError("Child", id)` when the caller is not the child's parent.

- [ ] **Step 1: failing tests** — change-email (uniqueness, resets verified, re-sends activation), edit-preferences persists, resend-verification sends, and each rejects a non-parent caller (404). Reuse `is_parent_of` pattern from `set_child_password`.

- [ ] **Step 2:** run → FAIL.

- [ ] **Step 3: services** — each loads the child `StudentProfile` (select_related user), checks `is_parent_of(parent_user_id, student.user_id)` (else `NotFoundError`), then acts: `set_child_email` validates uniqueness, updates `User.email` + the primary `EmailAddress` (email + verified=False), re-sends activation (`_send_child_activation`, has_password = child has a usable password via `child.user.has_usable_password()`); `set_child_preferences` sets `time_preferences`/`teacher_gender_preference` + saves; `resend_child_verification` re-sends activation.

- [ ] **Step 4: views + urls** — `ChildEmailView` (`POST children/<int:student_profile_id>/email/`), `ChildPreferencesView` (`PUT children/<int:student_profile_id>/preferences/`), `ChildResendVerificationView` (`POST children/<int:student_profile_id>/resend-verification/`), all `IsAuthenticated`, validating with small serializers (`ChildEmailSerializer{email}`, reuse `StudentProfileSerializer` for preferences). Wire in `urls.py`.

- [ ] **Step 5:** run → PASS; full suite; ruff/mypy/import-linter.

- [ ] **Step 6:** commit `feat(identity): parent manages child email/preferences/resend`.

---

### Task 4: dashboard — AddChildForm collects email + optional password; data layer

**Files:** Modify `dashboard/src/features/identity/schemas.ts` (`addChildSchema`, `Child` type), `api.ts` (`addChild` payload + new methods), `queries.ts` (hooks); `components/AddChildForm.tsx` + its test.

**Interfaces:** `addChildSchema = z.object({ full_name: z.string().min(1), email: z.email(), password: z.string().min(8).optional().or(z.literal("")) })`. `Child` type gains `email: string; verified: boolean`. New api: `setChildEmail`, `setChildPreferences`, `resendChildVerification`; hooks `useSetChildEmail`, `useSetChildPreferences`, `useResendChildVerification` (invalidate `["children"]`).

- [ ] **Step 1:** update `AddChildForm.test.tsx` — fill name + email (+ optionally password); assert `addChild` called with `{full_name, email, password?}`. Mirror existing AddChildForm test.
- [ ] **Step 2:** run → FAIL.
- [ ] **Step 3:** add email + optional password `Field`s to `AddChildForm` (autoComplete off / new-password); extend `addChildSchema`; extend `api.addChild` to send email+password; add the three new api methods + hooks.
- [ ] **Step 4:** run → PASS; tsc.
- [ ] **Step 5:** commit `feat(ui): add-child collects email + optional password`.

---

### Task 5: dashboard — /family child management surface

**Files:** Modify `dashboard/src/features/identity/components/ChildrenCard.tsx` + its test; add `EditChildPreferencesDialog.tsx` + `ChangeChildEmailDialog.tsx` (mirror `SetChildPasswordDialog.tsx`); `locales/{en,ar}/common.json`.

- [ ] **Step 1:** update `ChildrenCard.test.tsx` — assert each child shows a Verified/Pending badge + email; an "Edit preferences" action opens a dialog that submits prefs; a "Change email" action; "Resend verification" shown for pending children. Mirror existing ChildrenCard tests; render `<Toaster/>` for success toasts.
- [ ] **Step 2:** run → FAIL.
- [ ] **Step 3:** in `ChildrenCard`, render per child: `{child.email}` + a badge (`child.verified ? t("family.verified") : t("family.pending")`); actions: existing SetChildPasswordDialog, new `EditChildPreferencesDialog` (reuse the teacher-gender select + time-slot rows from `StudentPreferencesCard`; on save call `useSetChildPreferences`), `ChangeChildEmailDialog` (email field → `useSetChildEmail`), and a "Resend verification" button (only when `!child.verified`) → `useResendChildVerification`. Success → toast. Add i18n keys: `family.verified`, `family.pending`, `family.editPreferences`, `family.changeEmail`, `family.resendVerification`, `family.childEmail`, `family.prefsSaved`, `family.emailChanged`, `family.verificationResent` (en + ar).
- [ ] **Step 4:** run full `vitest` + tsc + biome.
- [ ] **Step 5:** commit `feat(ui): manage child verification, email + preferences on /family`.

---

## Self-review notes

- Spec coverage: real-email child (T2), verify like adults (T1 reuse + T2 send), both password paths (T2 has_password branch + T1 verify-on-reset), parent manages email/prefs/resend (T3), dashboard create + manage (T4/T5), legacy children migrate via change-email (T3 `set_child_email`). ✓
- The implementer must locate the existing children test module (likely `test_email_management.py` has child-adjacent tests, or a dedicated file) and the existing `AddChildForm`/`ChildrenCard` tests; named patterns (`is_parent_of`, `mandatory_verification`, `mailoutbox`, SetChildPasswordDialog) are all in-repo references.
- allauth `send_confirmation()` arg shape is the one runtime unknown — Step-4 note tells the implementer to match `test_api_resend_verification`.

# Local Development Setup

## Prerequisites

- Docker + Docker Compose
- Python 3.12+
- Node.js 22+ with pnpm
- just (task runner): `cargo install just` or `sudo pacman -S just`

## Quick start

1. Clone the repo with submodules:
   ```bash
   git clone --recursive <repo-url>
   cd kaleem
   ```

2. Run the setup command:
   ```bash
   just setup
   ```

3. Start all services:
   ```bash
   just dev
   ```

4. Verify:
   - Backend API: http://localhost:8000/health/live/
   - Django admin: http://localhost:8000/admin/
   - Dashboard: http://localhost:5173
   - Marketing: http://localhost:4321
   - Mailpit: http://localhost:8025

## Test users

`just seed` runs `python manage.py seed basic`, which runs the e2e fixture manifest
(`backend/config/e2e_seeds.txt`) and so creates synthetic accounts on the reserved
`kaleem.test` domain. It refuses to run unless `DEBUG` is on and `DJANGO_FRONTEND_URL`
is a local host. Sign in with:

| Role | Email | What it has |
| --- | --- | --- |
| Teacher | `e2e.asm.teacher@kaleem.test` | one student, four lessons in the states a close-out starts from, a filed report |
| Student | `e2e.asm.student@kaleem.test` | the same lessons seen from the student side, one `held` with a report, one `student_absent` |
| Parent | `e2e.asm.parent@kaleem.test` | linked to that student, may read the report |
| Staff | `e2e.staff@kaleem.test` | `is_staff`, no role profile |
| Student with upcoming lessons | `e2e.booked@kaleem.test` | booked lessons, one joinable now (teacher `e2e.teacher@kaleem.test`) |

The password is `E2E_PASSWORD` in
`backend/kaleem/identity/management/commands/seed_e2e.py`; it is not repeated here. Run
`just seed` again whenever you want the time-relative lessons (joinable now, still to
close) moved back into place: it converges on the same accounts and does not reset the
database. The other accounts in the manifest (billing states, family, rebook) are listed
in the seed modules named in that file.

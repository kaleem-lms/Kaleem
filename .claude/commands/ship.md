Walk the Definition of Done checklist (D9) for the current feature.

Verify each item:
- [ ] Spec committed and status=shipped
- [ ] Plan committed and status=done, all steps checked
- [ ] All tests passing locally and in CI
- [ ] import-linter green
- [ ] 100% coverage gate green (line + branch) in CI — exclusions per-line and justified (ADR-0021)
- [ ] End-to-end tests (Playwright) green for the feature's primary happy path + key failure paths, run against a real built app (ADR-0021)
- [ ] Self-review checklist walked
- [ ] Manually tested golden path in browser
- [ ] 2 edge cases manually tested
- [ ] Deployed to staging, smoke-tested
- [ ] Module architecture doc updated if public API changed
- [ ] Journal entry written
- [ ] STATE.md updated
- [ ] ISSUES.md reviewed for new issues

Do NOT mark the feature as complete until ALL items are checked.
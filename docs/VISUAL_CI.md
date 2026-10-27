# Punch 360 — automatic, non-invasive visual QA

This PR adds **screenshots of real locally served code** on pull requests, plus image diffs against owner-approved Figma exports. Screenshots and reports are archived as GitHub Actions artifacts for 14 days, not uploaded to Figma. No Figma paid API or token is required.

- Source: .github/workflows/visual-review.yml
- Capture implementation: .github/scripts/visual-capture.cjs
- Diff/report: .github/scripts/visual-compare.cjs
- Optional approved reference: visual-baselines/<same screenshot filename>.png
- Result: visual-captures/report.json, visual-captures/WORK_VISUAL_FIX.md, and diff-* images on failures.

**Important:** Connected Figma file links are design context, not CI authentication. Figma node exports are not automatically available to GitHub Actions. Until the owner approves and places each reference PNG, this workflow captures screenshots and reports `awaiting-approved-Figma-baseline`; it does not pretend that Figma pixel comparisons already succeeded. Never accept a new baseline automatically to make failing tests pass.

The comparator marks a screen as failing when over 5% of pixels differ by more than 40/255 per channel or its dimensions differ. Real WebGL and platform fonts may require a different design validation approach; keep baselines at the exact same viewport size.

**Scope/security:** This workflow only runs read-only browser tests. It does not write to production Supabase, modify data, payments, role permissions, or merge/release code. The first capture covers the public logged-out screen only, not authenticated employee/admin flows; those need synthetic fixtures or a separate authorized test environment.

**Work correction loop:** When an approved baseline comparison fails, an *active* ChatGPT Work session can consume the report and screenshot artifacts, adjust UI code, run the checks and update the PR. GitHub Actions cannot launch or keep Work running by itself. A visual finding never authorizes edits to payment, secrets, authentication, company isolation, scheduling, payroll, or business logic.

To review manually: GitHub -> Actions -> 'Punch 360 safe visual review' -> latest run -> artifact. To compare after visual approval: export a PNG of the approved Figma frame at the exact screenshot dimensions, commit it under `visual-baselines/` with the matching filename. Never edit a baseline without owner approval.

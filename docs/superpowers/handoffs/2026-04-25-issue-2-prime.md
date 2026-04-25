# Prime — Issue #2: Backdate prior usage and edit pack size

**For:** a fresh Claude Code session opening this repo to start implementation.
**From:** session on 2026-04-25 that drafted and filed the issue.

---

## Paste this into the new session as the first message

```
We are starting implementation of GitHub issue #2 in biswan07/fusion-steps:
"Backdate prior usage and edit pack size on subscriptions".

Brainstorming and design are COMPLETE — the issue body IS the spec. Do not
re-brainstorm. Do not re-open scope decisions that the issue already locks.

Bootstrap steps:

1. Read the full issue:
     gh issue view 2 --repo biswan07/fusion-steps
   This contains: Summary, verbatim user feedback (Sriparna), Problem,
   Requirements R1-R7, User Stories US-1..US-5 with acceptance criteria,
   Technical Design (data model, new Cloud Function `editSubscription`,
   modifications to `onAttendanceCreated`, UI changes, Firestore rules),
   Validation table, Out-of-scope list, Edge cases, Test plan, Definition
   of Done.

2. Confirm CLAUDE.md (auto-loaded) is in context. Honour: AEST + DD/MM/YYYY,
   theme palette, server-only subscription deduction, existing FCM gotchas.

3. Invoke the writing-plans skill:  superpowers:writing-plans
   Convert the issue's user stories into a TDD-ordered implementation plan.
   The plan should be sliced by US, with tests-first per slice. Each slice
   should be independently mergeable.

4. Set the project board: move issue #2 from Backlog → In progress.
     Project #7 owner biswan07. Use `gh project item-edit` with the
     Status field ID PVTSSF_lAHOA7V4Ss4BVomxzhRDHTc and option
     id 47fc9ee4 (= "In progress"). Item ID is PVTI_lAHOA7V4Ss4BVomxzgq9BV8.

5. Suggested first slice — Cloud Function changes (lowest UI surface area,
   highest leverage, needed by US-1/US-3):
     a. Modify functions/src/onAttendanceCreated.ts to:
        - Read `isBackdated` from the new attendance doc.
        - Skip both FCM sends (low-balance + attendance receipt) when true.
        - Still perform FIFO decrement (unchanged).
        - Append a `backdate-dates` editHistory entry to the affected
          subscription doc when isBackdated is true.
     b. Add tests in tests/ for the trigger using the Firebase emulator
        (or unit-test the pure logic if the trigger is split into a
        testable helper).
     c. Update firestore.rules to allow teacher-set `isBackdated: true`
        on attendance creates.

6. Then build editSubscription Cloud Function (US-4 + US-3 by-count path),
   then UI changes (PackEditDialog component, AssignSubscription tab,
   StudentProfile actions + history strip), then US-5 history rendering.

7. Definition of Done is in the issue body — including updating CLAUDE.md's
   "Gotchas" section with notes on isBackdated + FCM suppression once shipped.

Use TDD per the project conventions. Both platforms? — this feature is
PWA-only (the iOS app is a separate codebase: SmartReceiptsANZiOS, not
related). Just ship the PWA side.

Stakeholder: Sriparna Dutta (sole teacher user). When in doubt about UX
phrasing, default to plain English / non-technical language.

Begin.
```

---

## What's already done in the prior session

- Brainstorming via `superpowers:brainstorming` skill
- 4 rounds of `AskUserQuestion` to lock scope (see issue #2 body)
- Issue #2 filed against `biswan07/fusion-steps`
- Added to Project #7 with Status=Backlog, Priority=P1, Size=M
- Memory seeded at `~/.claude/projects/.../memory/`:
  - `github_project_fusion_steps.md` — project board reference
  - `feature_workflow_preference.md` — brainstorm-then-issue flow
  - `sriparna_stakeholder.md` — vocabulary disambiguation hints
- CLAUDE.md updated with backlog pointer

## What is NOT done

- No implementation code. None.
- No writing-plans output yet (intentional — fresh session does that).
- CLAUDE.md "Gotchas" section has NOT been updated for `isBackdated` /
  FCM suppression — that's part of Definition of Done after implementation.

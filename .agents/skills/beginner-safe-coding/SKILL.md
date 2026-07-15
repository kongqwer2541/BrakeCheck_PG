---
name: beginner-safe-coding
description: Use this skill when working on the BrakeCheck project in a beginner-safe way: planning before coding, explaining in Thai, naming files before edits, protecting real database/data, avoiding new dependencies/frameworks, and keeping changes small and reviewable.
---

# Beginner Safe Coding

Use this skill for BrakeCheck work where the user needs careful, beginner-friendly, low-risk coding help.

## Core Rules

- Reply in Thai by default.
- Explain step by step with simple words.
- Analyze the task before writing code.
- Keep the scope small and focused.
- Read only files that are needed for the current task.
- If more context is needed, ask which file to read before broad exploration.
- Do not make unrelated refactors.
- Do not add dependencies without explicit approval.
- Do not add frontend frameworks or backend frameworks without explicit approval.
- Use the existing HTML, CSS, and JavaScript patterns.
- Do not add Next.js, Tailwind CSS, TypeScript, shadcn/ui, lucide-react, or a new framework unless the user explicitly approves.

## Before Editing

Always tell the user:

- Which files will be created or edited.
- Why each file needs to change.
- Whether the change touches frontend, backend, database, or docs.
- Whether the change is safe for production data.

Wait for approval when the user asks for a plan, review, or says not to edit yet.

## Database Safety

- Treat the real database as valuable production data.
- Do not delete real data.
- Do not hard-delete production records unless the user explicitly requires it.
- Prefer status, audit history, or void/cancel workflows over deletion.
- Before changing database schema, tell the user the migration file name and purpose.
- Before running database migrations against a real database, recommend backup first.
- For risky database work, ask the user to confirm backup or confirm that the database is test/local.
- Never expose database passwords, secrets, tokens, or `.env` values.

## Validation And Security

- Validate again on the backend; never trust client input alone.
- Check auth and role before important APIs.
- Keep session-expired behavior clear.
- Do not expose internal stack traces to users.
- Escape user/server text before rendering in HTML.
- Prevent duplicate submit for important save actions.
- For Excel import, preserve BrakeCheck rules:
  - Read only sheet `DATA`.
  - Support only `.xlsx` and `.xlsm`.
  - Column A `Lot` is the main key and must not duplicate.
  - Column R `Lot Pack` can repeat and is used for barcode scan.
  - Column X `Lot ผลิต` can repeat and is used for packing checks.
  - Column T `วันฝน` must be validated before save.

## Working Style

- Prefer a short plan before code.
- Edit only files related to the requested step.
- Use existing project helpers and style.
- Keep UI practical for QC factory users.
- Add loading, empty, error, and disabled states where relevant.
- After editing, summarize:
  - What changed.
  - Which files changed.
  - What checks/tests were run.
  - What was not tested.

## Git Safety

- Do not run `git add`, commit, push, merge, reset, or checkout destructive commands unless the user asks.
- Before a new coding step, check `git status`.
- Use `codex/step-name` branches for feature work when asked to implement.
- Do not update `docs/git-branch-workflow.md` unless the user asks.

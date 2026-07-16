# AGENTS.md

## Project Summary

BrakeCheck_PG is the PostgreSQL migration workspace for BrakeCheck, a Chrome-based web app for QC staff in a brake pad factory. It keeps the same local Windows workflow while moving the database target from MySQL to PostgreSQL 17.

- Frontend: HTML, CSS, JavaScript
- Backend: Node.js, Express
- Target database: PostgreSQL 17
- Source baseline: BrakeCheck MySQL version
- Legacy backup/reference project: `C:\Users\KONG\Documents\BrakeCheck`
- Tools: Git, GitHub, VS Code, Chrome

Keep the system low-cost, local-first, beginner-readable, secure, and maintainable.

Treat MySQL files and docs in this repo as source/reference until an approved PostgreSQL phase replaces them. Do not edit or connect to the original MySQL project/database unless the user explicitly approves.

## How To Work With The User

- Reply in Thai by default.
- Teach step by step because the user is a beginner.
- Explain technical terms when they first appear.
- Do not code immediately when the user asks to plan or review.
- Before editing, say which files will change and why.
- After editing, summarize what changed and what was tested.
- Keep each step small and focused.
- Do not delete existing code unless clearly needed.
- For code review, focus on Security, Validation, Error Handling, and Code Readability.
- Do not run `git add`, commit, push, or merge unless the user asks.
- Do not update `docs/git-branch-workflow.md` unless the user asks.

## Do Not Add Without Approval

Do not add these without explicit approval:

- Next.js
- Tailwind CSS
- TypeScript
- shadcn/ui
- lucide-react
- New frontend framework
- New backend framework
- Paid service
- Paid database
- Cloud database with possible long-term cost
- Library with unclear license or future cost

If a new dependency is proposed, explain what it does, why it is needed, license/cost, complexity impact, and no-dependency alternatives.

## Important Business Rules

- Excel import reads only sheet `DATA`.
- Import supports only `.xlsx` and `.xlsm`.
- Column A = `Lot`
  - Unique 100%.
  - Main key for QC inspection.
  - Duplicate Lot in Excel is an error.
- Column R = `Lot Pack`
  - Can repeat.
  - Used for barcode scan.
  - If one Lot Pack maps to many Lots, user must choose the Lot.
- Column X = `Lot ผลิต`
  - Used for packing/sticker check.
  - Can repeat.
  - Use `-` when empty.
- Column T = `วันฝน`
  - Production date from Excel.
  - Invalid date must warn before save.
  - If Excel formula output is wrong, ask user to fix Excel first unless approved otherwise.
- QC inspection record must be tied to Column A `Lot`.
- Do not hard-delete production data unless explicitly required.
- Use status/audit history for corrections and traceability.
- Approved data must be locked; head user must cancel approval before edits.
- Completed inspection data should become a snapshot.

## UI Rules

- Use existing plain HTML/CSS/JavaScript patterns.
- Match the current BrakeCheck style: modern, clean, SaaS-like, practical factory UI.
- Main colors: blue, orange, white, following the COMPACT logo.
- Use spacing, soft shadow, and 8-12px border radius.
- Support desktop, tablet, and mobile.
- Include hover, loading, empty, and error states where relevant.
- Tables must be readable and support horizontal scroll when needed.
- Keep text short and clear for QC users.

## Security And Validation

- Passwords must be hashed; never store plain text passwords.
- Check auth and role before important APIs.
- If session expires, return to Login.
- Do not expose passwords, tokens, database credentials, or internal stack traces.
- Validate again on backend; never trust client input alone.
- Escape user/server text before rendering in HTML.
- Prevent duplicate submit for important actions.
- Validate Excel type, sheet name, required columns, Lot duplicate, date, quantity, and required fields before save.

## Data Safety Rules

- Treat production data as valuable factory records.
- Do not hard-delete real production data unless the user explicitly asks for it and confirms the risk.
- Never run `DROP DATABASE` on any BrakeCheck database.
- Never run `DROP TABLE` on a real database.
- Never run `TRUNCATE TABLE` on a real database.
- Never reset the database unless the user clearly asks for it and confirms which database is safe to reset.
- If unsure whether a database is real or test/local, stop and ask the user before running any write, migration, delete, truncate, drop, or reset command.
- Prefer status fields, audit history, void/cancel workflows, or soft-disable behavior instead of deleting records.
- Do not commit `.env`, real passwords, tokens, database credentials, backup database files, dumps, logs, or private factory data to GitHub.

## Database Migration Rules

- Before editing database schema, say which migration/schema files will change and why.
- Keep migrations small, reviewable, and tied to the current step.
- Migration files should be safe to understand for a beginner.
- Avoid destructive SQL in migrations.
- Do not include `DROP DATABASE`, production `DROP TABLE`, or production `TRUNCATE TABLE` in migrations.
- Before running a migration against a real database, tell the user to back up the database first.
- If the migration changes existing production data, explain the risk and ask for approval before running it.
- Keep schema changes in `server/src/database/` and avoid mixing unrelated code refactors into the same step.

## Backup And Restore Rules

- Recommend a database backup before any migration, bulk update, import overwrite, repair script, or risky data operation.
- Confirm whether the database is test/local or real production before running risky database commands.
- Temporary local backups may be created under `backups/` because this folder is ignored by Git.
- For important or long-term backups, copy the backup file outside the repo or to the company-approved storage location.
- Do not commit database backup files to GitHub.
- Auto Backup scripts must not contain real passwords; read secrets from `.env` only and never print them.
- Do not commit `backups/`, `*.sql`, backup logs, `.env`, or real factory backup files.
- Do not create automatic Restore workflows.
- Do not run database migrations automatically from backup scripts.
- Do not delete old backup files unless a clear retention rule is approved and documented first.
- If a restore is needed, explain the source backup file, target database, and expected effect before running restore commands.
- If backup or restore steps are unclear, stop and ask the user before continuing.

## Windows Helper Button Rules

- Windows helper scripts must live in `scripts/` and use `.bat` only when requested.
- Do not put real passwords, tokens, or database credentials directly inside `.bat` files.
- Helper scripts must pause on error so beginner users can read the message before the window closes.
- Backup helper scripts must write backup files under `backups/`.
- Never commit database backup files to GitHub.
- Do not make `.bat` scripts run destructive database commands such as `DROP`, `TRUNCATE`, reset, or hard delete.
- Do not make helper scripts run Restore or migration automatically.
- Do not make helper scripts delete old backups without an approved retention rule.
- If a helper script touches the database, make it clear whether it reads, backs up, or writes data.

## Environment Rules

- Keep real environment values in `.env` only.
- Do not commit `.env`.
- Keep `.env.example` safe and use placeholder values only.
- Do not print secrets, tokens, database passwords, or private factory data in chat or logs.
- Do not change ports, database names, credentials, or deployment settings unless the user asks.
- If local setup differs from production, say which environment is being used before running commands that write data.

## Deployment Rules

- BrakeCheck is local-first and should avoid paid services or cloud databases unless explicitly approved.
- Do not introduce paid hosting, paid databases, cloud storage, or external services without approval.
- Do not change production deployment behavior during feature work unless the task is specifically about deployment.
- Before deployment-related changes, explain what machine, network, database, and environment file are affected.
- For factory use, prefer simple Windows/Chrome/PostgreSQL workflows that a beginner can maintain.

## Beginner Support Requirements

- Explain technical terms the first time they appear.
- Use short Thai explanations and small steps.
- Before editing, list the files to be created or changed and explain why.
- After editing, summarize what changed, which files changed, and what was tested.
- If a task is risky, say the risk plainly and ask before continuing.
- If the user asks to plan or review, do not edit code until approved.
- Prefer practical examples and exact commands over abstract explanations.

## Documentation Requirements

- Update docs only when the user asks or when a code/database change would otherwise make the docs misleading.
- Do not update `docs/git-branch-workflow.md` unless the user asks.
- Keep documentation short, clear, and beginner-readable.
- When adding business rules, include the reason and where the rule is enforced.
- Do not document secrets, real passwords, private factory data, or database backup contents.

## Testing Rules

- Run the relevant checks for the files changed.
- For JavaScript changes, run `node --check` on the changed area or the existing common checks.
- For database/API changes, test success cases, validation errors, permission errors, and edge cases when practical.
- For UI changes, check loading, empty, error, disabled, and mobile/tablet-friendly states where relevant.
- If a test cannot be run, say why and what risk remains.
- Do not run destructive tests on real data.
- Use clearly named test data and clean it up after manual API/database testing when safe.

## Recommended Skills

- Use `beginner-safe-coding` for BrakeCheck coding tasks that need careful beginner-safe workflow.
- Use `frontend-skill` for UI, layout, responsive, or browser verification work.
- Use GitHub-related skills only when the user asks for PR, CI, issue, or GitHub work.
- Use document/spreadsheet/PDF skills only when the task involves those file types.

## Project Structure

- `client/` frontend files served in Chrome.
- `client/src/pages/` page render/bind files.
- `client/src/services/` frontend API calls.
- `client/src/styles/` main CSS.
- `client/src/utils/` reusable frontend helpers.
- `server/` Node.js/Express backend.
- `server/src/routes/` API routes.
- `server/src/controllers/` request/response handlers.
- `server/src/services/` business logic and database work.
- `server/src/database/` schema and migrations.
- `docs/` reference documents. Read only the relevant docs for major workflow, database, business rule, import/export, inspection, approval, or reporting changes.

## Git Workflow

Before a new step:

```bash
git status
git switch main
git pull --ff-only
git switch -c codex/step-name
```

During work:

- Edit only files related to the current step.
- Keep unrelated refactors out.
- If a new issue appears, tell the user before expanding scope.

After work:

- Run relevant tests/checks.
- Summarize changed files and test results.
- Wait for user approval before `git add`.
- Use short Conventional Commits, for example:
  - `feat: add excel import preview`
  - `fix: handle expired api session`
  - `refactor: organize app helpers`
  - `docs: update project workflow`

## Common Checks

Syntax check:

```powershell
Get-ChildItem -Path client/src -Recurse -Filter *.js | ForEach-Object { node --check $_.FullName }
Get-ChildItem -Path server/src -Recurse -Filter *.js | ForEach-Object { node --check $_.FullName }
git diff --check
```

Run server:

```powershell
cd server
npm start
```

Useful URLs:

- App: `http://localhost:3000/`
- API health: `http://localhost:3000/api/health`
- Database health: `http://localhost:3000/api/database/health`

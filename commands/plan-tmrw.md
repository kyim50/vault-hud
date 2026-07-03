---
label: PLAN TMRW
description: Draft tomorrow's plan tonight
allowed-tools: Read Write Glob Grep Bash(git -C:*) Bash(git status:*) Bash(git log:*) Bash(date:*)
---
Draft my plan for TOMORROW (the day after {{date}}). Compute tomorrow's date yourself.

Inputs (fail soft): today's plan and its unchecked tasks in "{{vaultPath}}/{{dashboardFolder}}/Plans/", today's brief in Briefs/, and repo state:
{{repos}}

Write "{{vaultPath}}/{{dashboardFolder}}/Plans/<tomorrow> Plan.md" (same format as today's plans: "## Directives" with "- [ ] task" lines, "## Schedule" if known, "## Focus"). Under 40 lines. Create folders if missing.

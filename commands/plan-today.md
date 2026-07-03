---
label: PLAN TODAY
description: Prioritized day plan from notes, calendar, open work
allowed-tools: Read Write Glob Grep Bash(git -C:*) Bash(git status:*) Bash(git log:*)
---
Draft my plan for {{date}}.

Inputs (fail soft on each):
1. Today's morning brief at "{{vaultPath}}/{{dashboardFolder}}/Briefs/{{date}} Morning Brief.md" if it exists — pull the schedule and inbox highlights.
2. The most recent prior plan in "{{vaultPath}}/{{dashboardFolder}}/Plans/" — carry over unchecked tasks.
3. Current state of my repos (uncommitted work = something in flight):
{{repos}}

Write "{{vaultPath}}/{{dashboardFolder}}/Plans/{{date}} Plan.md" with:
- A "## Directives" section: 3–6 tasks as "- [ ] task" checkbox lines, hardest/most important first (my dashboard shows the top 3).
- A "## Schedule" section with "- HH:MM item" lines if calendar data exists.
- A two-sentence "## Focus" note on what actually matters today.
Create folders if missing. Keep the whole note under 40 lines.

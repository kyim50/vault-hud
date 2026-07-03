---
label: WK REVIEW
description: Commits shipped, notes written, plan vs reality
allowed-tools: Read Write Glob Grep Bash(git -C:*) Bash(git log:*)
---
Write my week-in-review for the 7 days ending {{date}}.

Inputs (fail soft):
1. Per-repo `git -C <path> log --since=7.days --oneline` for:
{{repos}}
2. This week's plans in "{{vaultPath}}/{{dashboardFolder}}/Plans/" — compare directives written vs checked off.
3. Notes generated this week in "{{vaultPath}}/{{dashboardFolder}}/".

Write "{{vaultPath}}/{{dashboardFolder}}/Reviews/{{date}} Week Review.md" with: ## Shipped (commits grouped by repo), ## Plan vs Reality (honest), ## Next Week (3 bullets). Create folders if missing.

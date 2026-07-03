---
label: PROJECT STATUS
description: What's in flight across all repos
allowed-tools: Read Write Glob Grep Bash(git -C:*) Bash(git status:*) Bash(git log:*) Bash(git branch:*)
---
Sweep my repos and write a status report.

For each repo:
{{repos}}

Run `git -C <path> status --porcelain`, `git -C <path> log --oneline -5`, and `git -C <path> branch --show-current`. For each ACTIVE repo (commits in the last 14 days or uncommitted changes) write: current branch, what the recent commits suggest is in flight, uncommitted file count, and one suggested next action. List dormant repos in one line at the end.

Write to "{{vaultPath}}/{{dashboardFolder}}/Reports/{{date}} Project Status.md". Create folders if missing.

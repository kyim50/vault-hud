---
label: MORNING BRIEF
description: Inbox + calendar + overnight git in one note
allowed-tools: Read Write Glob Grep Bash(git -C:*) Bash(git log:*) Bash(date:*) mcp__claude_ai_Gmail__search_threads mcp__claude_ai_Gmail__get_thread
---
You are generating my morning brief for {{date}}.

Gather, failing soft on anything unavailable (write the section as "unavailable" and move on):
1. EMAIL — if Gmail tools are available, search threads from the last 24h in my inbox; summarize the 5 most important with sender + one-line gist. Note unread count if visible.
2. CALENDAR — if Calendar tools are available, list today's events as "- HH:MM Title" lines under a "## Schedule" heading (this exact line format matters — my dashboard parses it).
3. GIT — for each repo below, run `git -C <path> log --since=yesterday --oneline` and summarize overnight/last-evening activity in one line per active repo. Skip silent repos.

Repos:
{{repos}}

Write the result to "{{vaultPath}}/{{dashboardFolder}}/Briefs/{{date}} Morning Brief.md" as clean markdown with sections: ## Inbox, ## Schedule, ## Overnight Git, ## One Thing That Matters (your judgment). Keep it under 60 lines. Create folders if missing.

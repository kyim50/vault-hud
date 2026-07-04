# vault

A halftone pixel HUD that wraps Claude Code. Live vitals for your repos, a
one-click command deck that writes into your Obsidian vault, a clay mascot
living through six animated scenes, a Boring Notch-style island under your
MacBook notch, and a menu-bar readout of your Claude 5h window.

Ink dots on `#1e1e1e`. The mascot is the only thing with color.

## What it does

- **System vitals** — commits this week, branch, and dirty files for every
  repo you track, with pixel sparklines; plus your rolling Claude 5h-window
  usage parsed from `~/.claude` transcripts.
- **Command deck** — one-click buttons that run Claude Code headlessly:
  Morning Brief, Plan Today, Plan Tmrw, Project Status, Wk Review. Every
  command is a plain markdown prompt in `commands/` — edit them freely.
  Output lands in your Obsidian vault as notes; the HUD is just a lens.
- **Directives** — the top tasks from today's plan note; checking one writes
  `- [x]` back into the markdown.
- **Core** — the mascot rotating through meadow, surf, garden, disco, globe,
  and night scenes; scene changes dissolve into a spinning constellation orb.
  While a command runs it locks to the disco (Claude's cooking).
- **Notch island** — invisible until you slide your pointer under the
  hardware notch; expands into artwork + STATUS / PLAN / GIT / RUN tabs.
- **Tray** — `◉ N%` of your Claude window, always visible, with a quick-run
  menu.

## Requirements

- macOS (Apple Silicon or Intel — the app ships universal)
- [Claude Code](https://claude.com/claude-code) installed and logged in
  (`claude` must be on your PATH — the command deck shells out to it)
- git
- [Obsidian](https://obsidian.md) is optional but recommended; without a
  vault the command outputs still land in the configured folder as markdown

## Install (for friends)

1. Grab `vault-<version>-universal.dmg` from `release/` (or the shared
   link), open it, drag **vault** to Applications.
2. First launch: the app is unsigned, so **right-click → Open → Open**
   (Gatekeeper only asks once).
3. On first run vault writes `~/.vault-hud/config.json`, auto-detecting
   git repos on your Desktop and your Obsidian vault. Edit it (see below)
   and relaunch.

## Run from source

```bash
npm install
npm run dev                  # develop with hot reload
npm run build && npm start   # production run
npm run dist                 # build the universal .dmg/.zip into release/
npm test                     # vitest
```

## Config — `~/.vault-hud/config.json`

| field | meaning |
|---|---|
| `appName` | the name in the header (default `vault`) |
| `vaultPath` | absolute path to your Obsidian vault |
| `dashboardFolder` | folder inside the vault for generated notes (`Dashboard`) |
| `repos` | `{ name, path }[]` — prune the auto-detected list to what you care about |
| `claude.windowHours` | rolling usage window (default 5) |
| `claude.windowTokenLimit` | tokens ≙ 100% — tune to your plan |
| `primaryDirective` | the big counter: `label`, `target`, `unit`, `source` (`commitsThisWeek` or `manual`) |

Restart the app after editing. A corrupted config is never overwritten —
vault boots with in-memory defaults and leaves your file alone.

## Commands

Each file in `commands/` is one deck button:

```markdown
---
label: MORNING BRIEF
description: Inbox + calendar + overnight git in one note
allowed-tools: Read Write Glob Grep Bash(git -C:*)
---
The prompt. {{vaultPath}}, {{dashboardFolder}}, {{date}}, {{repos}}
are filled in at run time.
```

Commands run one at a time through `claude -p`; failures show a red state
on the button — click it to read the log.

## Docs

- Spec: `docs/superpowers/specs/2026-07-03-vault-hud-design.md`
- Plan: `docs/superpowers/plans/2026-07-03-vault-hud.md`

<p align="center">
  <img src="docs/assets/banner.png" alt="vault" width="820" />
</p>

<p align="center">
  <em>a halftone pixel HUD that wraps Claude Code — your repos, your Obsidian vault,<br/>your Claude window, and a small clay critter who lives in all of it</em>
</p>

<p align="center">
  <img src="https://img.shields.io/badge/macOS-universal-1e1e1e?style=flat-square&labelColor=1e1e1e&color=d97757" alt="macOS universal" />
  <img src="https://img.shields.io/badge/electron-41-1e1e1e?style=flat-square&labelColor=1e1e1e&color=e8e6e3" alt="electron" />
  <img src="https://img.shields.io/badge/tests-29%20passing-1e1e1e?style=flat-square&labelColor=1e1e1e&color=d97757" alt="tests" />
  <img src="https://img.shields.io/badge/claude%20code-required-1e1e1e?style=flat-square&labelColor=1e1e1e&color=e8e6e3" alt="claude code" />
</p>

<p align="center">
  <img src="docs/assets/hud.png" alt="the vault HUD" width="880" />
</p>

---

# vault

## What it does

- **System vitals** — commits this week, branch, and dirty files for every
  repo you track, with pixel sparklines; plus your rolling Claude 5h-window
  usage parsed from `~/.claude` transcripts.
- **Command deck** — one-click buttons that run Claude Code headlessly:
  Morning Brief, Plan Today, Plan Tmrw, Project Status, Wk Review, Skill
  Miner. Every command is a plain markdown prompt in `commands/` — edit them
  freely. Output lands in your Obsidian vault as notes; the HUD is a lens.
- **Skill Miner** — reads your recent Claude Code session transcripts, finds
  where you stumbled explaining things, and writes a communication retro plus
  reusable skill cards into `Skills/` in your vault. The Skills panel shows
  the library growing.
- **Second Brain** — quick-capture box straight into `Inbox.md`, the freshest
  notes from anywhere in your vault, and one resurfaced note a day from the
  archive.
- **Pet box** — a corner desk pet that naps when you're idle, dances while
  commands run, throws hearts when clicked, and levels up from checked-off
  directives.
- **Sprite Studio** — drop any image into settings and it's crunched into an
  8-bit sprite in vault's ink + clay palette; send it marching in the top
  parade or make it your pet's skin. Two themes: terminal dark and paper.
- **Directives** — the top tasks from today's plan note; checking one writes
  `- [x]` back into the markdown.
- **Core** — the mascot living through eight scenes (meadow, surf, garden,
  disco, globe, night, rain, rooftop) with friends: buddies, birds, snails,
  fireflies. Scene changes dissolve into a spinning constellation orb. While
  a command runs it locks to the disco (Claude's cooking).
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

## Install

**Homebrew**

```bash
brew tap kyim50/tap
brew install --cask vault --no-quarantine
```

(`--no-quarantine` because the app is unsigned — otherwise Gatekeeper makes
you right-click → Open the first time.)

**Direct download**

1. Grab `vault-<version>-universal.dmg` from the
   [latest release](https://github.com/kyim50/vault-hud/releases/latest),
   open it, drag **vault** to Applications.
2. First launch: **right-click → Open → Open** (Gatekeeper only asks once).

Either way, on first run vault writes `~/.vault-hud/config.json`,
auto-detecting git repos on your Desktop and your Obsidian vault. Prune it in
the ⚙ settings panel (or by hand) and you're set.

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

# V.A.U.L.T.

A desktop HUD for people who live in an Obsidian vault and a terminal. It sits
on your menu bar (with a boring-notch-style island for quick commands) and
opens into a three-panel dashboard: your git repos, your Claude usage window,
your vault's directives/documents/schedule, and a command deck that fires
`claude -p` prompts on demand.

Visually it's a "Claude FM" paper aesthetic — cream background, near-black
ink, hairline borders, and a small clay-colored pixel mascot in the center
panel that pulses with your Claude usage. Clay is reserved for the mascot
and for live/danger states; everything else is monochrome.

## Install & run

```bash
npm install
npm run dev      # electron-vite dev, HUD + notch windows
npm run build    # production build to out/
npm test         # vitest
npm run typecheck # tsc --noEmit
```

On first launch, if no config exists yet, V.A.U.L.T. writes a starter config
and shows a banner in the HUD telling you where it landed and what to check.

## Config file

Location: `~/.vault-hud/config.json`

On first run this is generated automatically: it tries to detect your open
Obsidian vault (from `~/Library/Application Support/obsidian/obsidian.json`)
and any git repos under `~/Desktop`. Edit it and restart the app to pick up
changes.

Fields:

| Field | Type | Meaning |
|---|---|---|
| `appName` | string | Title shown in the HUD header. |
| `vaultPath` | string | Absolute path to your Obsidian vault. |
| `dashboardFolder` | string | Folder inside the vault (relative) where briefs/plans live, e.g. `Dashboard`. |
| `repos` | `{ name, path }[]` | Git repos tracked in the Vitals panel and passed to commands as `{{repos}}`. |
| `claude.windowHours` | number | Length of the Claude usage window (5h windows by default). |
| `claude.windowTokenLimit` | number | Token budget for that window, used to compute the usage %. |
| `primaryDirective` | object | The single counter shown under the mascot: `label`, `target`, `unit`, and `source` (`commitsThisWeek` to sum git commits across repos, or `manual` with a `manualValue`). |

Prune `repos` down to what you actually want tracked, and point `vaultPath`
at the vault you use for daily notes — the app fails soft on anything
missing (no vault, no repos, no Obsidian) rather than crashing.

## Command deck (`commands/`)

Each `.md` file in `commands/` is a Claude Code prompt template that shows up
as a button in the Command Deck panel. Format:

```markdown
---
label: PLAN TODAY
description: Prioritized day plan from notes, calendar, open work
allowed-tools: Read Write Glob Grep Bash(git -C:*) Bash(git status:*) Bash(git log:*)
---
Prompt body goes here. Use {{vaultPath}}, {{dashboardFolder}}, {{date}},
and {{repos}} — they're substituted before the prompt is sent to `claude -p`.
```

- The frontmatter's `label`/`description` populate the button and its
  tooltip; `allowed-tools` maps to `claude`'s `--allowedTools` flag.
- The body is rendered with the template variables above and piped to
  `claude -p <prompt> --output-format text` in the configured cwd.
- Runs are queued one at a time; state (`idle`/`queued`/`running`/`done`/
  `failed`) and the last log are pushed back to the HUD live.
- Add a new command by dropping another `.md` file in `commands/` and
  restarting the app — no code changes needed.
- Ship a new command with the app: five are included —
  `morning-brief.md`, `plan-today.md`, `plan-tmrw.md`, `project-status.md`,
  `week-review.md`.

## Vault as source of truth

The Directives panel reads `- [ ]` / `- [x]` checkbox lines out of your
vault's markdown files (under `dashboardFolder`) and writes toggles back to
the same file — Obsidian and the HUD stay in sync because they're both just
reading/writing the same notes. Clicking a document in the Documents panel
opens it in Obsidian via an `obsidian://` deep link.

## Spec & plan

Design notes and the implementation plan this app was built from live in:

- `docs/superpowers/specs/2026-07-03-vault-hud-design.md`
- `docs/superpowers/plans/2026-07-03-vault-hud.md`

Task briefs and reports for each build step are under `.superpowers/sdd/`.

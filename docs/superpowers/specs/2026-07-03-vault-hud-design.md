# V.A.U.L.T. HUD — Personal Agentic OS Dashboard

**Date:** 2026-07-03
**Status:** Approved design
**Owner:** Kimani McLeish

## What this is

A macOS desktop app (Electron + Vite + React) that wraps Claude Code in a
clickable, always-on dashboard — a personal "agentic OS." It shows live
metrics the terminal can't, fires one-click Claude Code commands, and uses
the Obsidian vault ("second brain", iCloud) as the source of truth for
everything Claude generates.

Visual direction: the V.A.U.L.T. HUD layout from the reference image,
rendered in an **8-bit / pixel-art aesthetic** in the style of Anthropic's
retro pixel illustrations — bitmap/pixel fonts, dithered shading, chunky
pixel-grid borders, limited dark palette with a single green accent.

## Surfaces (three windows)

1. **Main HUD window** — large dark dashboard, the centerpiece.
2. **Notch island** — Boring Notch-style frameless, transparent,
   always-on-top window hugging the MacBook notch. Collapsed: blends into
   the notch. On hover: expands into a small pixel-art island showing
   Claude 5h-window %, running command status, and quick-fire command
   buttons.
3. **Menu-bar tray** — status item showing Claude window % (e.g. `◉ 9%`).
   Click → mini menu: open HUD, fire any command, last-run status. Kept
   alongside the notch for external monitors without a notch.

## Architecture

Electron **main process** (Node/TypeScript) owns all data and side effects;
the **renderer** (React + Vite) is display-only, fed over IPC via a
contextBridge preload. Three renderer entry points share components: HUD
window, notch island, (tray is native menu, no renderer).

Config: one JSON file at `~/.vault-hud/config.json` — repo list, Obsidian
vault path, Claude plan token limits, primary directive
(label / target / current-value source), app name.

### Data collectors (main process, each fails soft)

A dead source renders as `—` with a "last updated" stamp; it never crashes
the HUD.

- **Git collector** — every 60s scans configured repos (Gym_AppV1,
  swifpay-web-app, rootiq-1, spatial-slm-next, …): current branch, last
  commit, uncommitted file count, commits today / this week. Powers left
  "System Vitals" column with pixel sparklines.
- **Claude usage collector** — parses `~/.claude/projects/**/*.jsonl`
  transcripts to compute rolling 5-hour-window token usage as a % of the
  configured plan limit. Powers the "CLAUDE 5H WINDOW" vital, tray title,
  and notch island.
- **Vault collector** — `fs.watch` on `<vault>/Dashboard/` in the Obsidian
  vault. Reads generated notes (briefs, plans, reports, reviews) to power
  the Directives, Schedule, and Documents panels.

### Command runner (main process)

Each command deck button = one markdown prompt file in `commands/`
(user-editable). Pressing a button spawns headless Claude Code
(`claude -p`) with that prompt; runs are queued one at a time. Status
events (idle → running → done/failed) stream to all surfaces. Output is
written to the Obsidian vault, not to app state.

Commands (v1):

| Command | Inputs | Output note |
|---|---|---|
| Morning Brief | Gmail + Google Calendar (via connected MCP) + overnight git | `Dashboard/Briefs/YYYY-MM-DD Morning Brief.md` |
| Plan Today / Plan Tmrw | recent vault notes + calendar + open work | `Dashboard/Plans/YYYY-MM-DD Plan.md` |
| Project Status | sweep of configured repos | `Dashboard/Reports/YYYY-MM-DD Project Status.md` |
| Week Review | week's commits + notes + plans vs. reality | `Dashboard/Reviews/YYYY-[W]ww Review.md` |

**Risk to verify early:** headless `claude -p` must have the Gmail/Calendar
connectors available outside interactive mode. If not, Morning Brief and
plans degrade gracefully to git + vault inputs only, and the schedule panel
hides.

## HUD layout (faithful to reference image, pixel-art rendered)

- **Left column — System Vitals:** per-repo commit vitals with pixel
  sparklines; Claude 5h window %; inbox unread (from latest brief);
  **Directives** — top-3 tasks parsed from today's plan note, checkboxes
  synced back to the Obsidian markdown; **Documents** — recent generated
  notes trail; click opens the note in Obsidian via `obsidian://` URI.
- **Center:** animated 8-bit pixel-art sprite scene (replaces the particle
  sphere) over a pixel grid floor; beneath it the big **Primary Directive**
  counter — label, target, progress — fully configurable in config.
- **Right column:** Command Deck (buttons with live run state), today's
  Schedule (from the brief/calendar note), status ticker.
- **Top:** app name (renameable), collector status lights, pixel clock.

Cut from v1 (YAGNI): voice I/O, news wire.

## Error handling

- Failed command → button shows red failed state; click reveals captured
  stdout/stderr log.
- Collector exceptions are caught per-collector; panel shows stale data
  with timestamp rather than blanking.
- Missing config → first-run screen that writes a starter config with
  detected repos and the detected vault path.

## Testing

- Unit tests (Vitest) for collectors against fixture data: git output
  parsing, `~/.claude` JSONL usage math, vault note parsing
  (directives/schedule extraction).
- Type-check (`tsc --noEmit`) clean.
- Manual end-to-end: launch app, all three surfaces render, fire Project
  Status command, note lands in vault, panels update.

## Build order (high level)

1. Scaffold electron-vite + React + TS; main HUD window shell with pixel
   theme.
2. Collectors + IPC plumbing + vitals panels.
3. Command runner + command deck + vault output.
4. Notch island + tray.
5. Directives/Schedule/Documents panels + Obsidian sync.
6. Polish pass on pixel art + animations.

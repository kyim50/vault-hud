---
label: SKILL MINER
description: Mine recent agent sessions for communication stumbles; grow a skill library
allowed-tools: Read Write Glob Grep Bash(ls:*) Bash(python3:*)
---
You are mining my recent CLI agent sessions to find where I struggle to communicate, then turning those stumbles into a reusable skill library in my vault.

## 1. Gather

My session transcripts are JSONL files under ~/.claude/projects/*/. Find the 6 most recently modified ones (skip any under a path containing "vault-hud" if there are enough others). For each, extract ONLY what I typed (user messages), using:

python3 -c "
import json,sys
for line in open(sys.argv[1]):
    try: j=json.loads(line)
    except: continue
    m=j.get('message',{})
    if m.get('role')!='user' or j.get('isSidechain'): continue
    c=m.get('content')
    t=c if isinstance(c,str) else ' '.join(b.get('text','') for b in c if isinstance(b,dict) and b.get('type')=='text')
    t=t.strip()
    if t and not t.startswith('<') and 'tool_result' not in t[:40]: print('---'); print(t[:600])
" <file>

## 2. Analyze

Look for places where I stumbled relaying what I wanted:
- corrections and re-explanations ("no i meant", "actually", "not like that", re-asking the same thing differently)
- vague first asks that needed several rounds to pin down
- terminology I misuse or avoid (describing a concept in a roundabout way because I don't have the word)
- patterns in typos/shorthand that cause ambiguity

Be honest but kind. I want to get better at directing AI tools.

## 3. Write

1. "{{vaultPath}}/{{dashboardFolder}}/Retros/{{date}} Communication Retro.md" — max 40 lines: ## Patterns (the 3-4 recurring stumbles with one real quoted example each), ## What Worked (things I phrased well), ## One Habit To Try.
2. First Read what already exists in "{{vaultPath}}/Skills/" (create the folder if missing), then write UP TO 4 NEW skill notes there — skip topics already covered. Each note is named for its topic (e.g. "Describing UI layout changes.md") and contains: a one-line "when to use", a fill-in-the-blank prompt template that says the thing precisely, and the vocabulary I was missing. Tag each with #skill on the last line.

Keep every note under 25 lines. These are cards I'll actually reuse, not essays.

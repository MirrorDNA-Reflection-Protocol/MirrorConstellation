# ⟡ MirrorConstellation

**A live visualization of a sovereign AI operating system — your knowledge, archetypes, and agent memory as a navigable star map.**

🔗 **Live demo:** [constellation.activemirror.ai](https://constellation.activemirror.ai)

---

## What it is

MirrorConstellation is the visual interface for [MirrorDNA](https://activemirror.ai) — a local-first, sovereign AI operating system built by one person over 10 months.

Three live views:

| Mode | What you see |
|------|-------------|
| **⟡ The Mirror** | Your captured moments, thoughts, and patterns — classified by archetype, confidence-weighted, governance-hashed |
| **⟡ Brain Scan** | Your full knowledge graph — 300+ nodes parsed live from a 5,000-note Obsidian vault |
| **⟡ Memory** | Agent memory topology — every AI session, handoff, and knowledge item as a navigable graph |

Everything runs **local-first**. Live data comes from a pattern engine on your machine (`localhost:8203`). The public demo shows mock data — your vault never leaves your hardware.

---

## Architecture

```
MirrorConstellation (React + D3)
    └── Pattern Engine (FastAPI, port 8203)
            ├── /api/mirror-data     ← vault archetypes + captured moments
            ├── /api/graph-data      ← full knowledge graph (live vault parse)
            ├── /api/rhythm          ← time-of-day physics modifier
            ├── /api/memory-graph    ← agent session memory topology
            └── /api/capture         ← capture new moments (POST)
```

The pattern engine reads a live Obsidian vault (~5,000 notes) and exposes it as a graph API. No database. No cloud. Governance hashes on every capture.

---

## Run locally

**Requirements:** Node 18+, Python 3.10+

```bash
# Clone
git clone https://github.com/MirrorDNA-Reflection-Protocol/MirrorConstellation
cd MirrorConstellation

# Install frontend
npm install

# Start pattern engine (serves mock data without a vault configured)
cd pattern_engine
pip install fastapi uvicorn
uvicorn server:app --port 8203 &

# Start frontend
cd ..
npm run dev
# → http://localhost:5174
```

Without the pattern engine, the app falls back to embedded mock data automatically.

---

## Features

- **D3 force simulation** — archetype clusters, physics layout, breath animation tied to time of day
- **Live capture** — type a thought, get it classified and added to the constellation in real time
- **Governance layer** — SHA-256 provenance hash on every capture; pending nodes quarantined until confirmed
- **WebSocket updates** — new captures appear across sessions without refresh
- **Memory graph** — agent session topology: conversations → knowledge items → handoffs → agents
- **Screenshot export** — capture the canvas as PNG
- **Local-first fallback** — last-known-state cache, graceful offline degradation

---

## Part of MirrorDNA

One component of a larger sovereign AI stack:

- **MirrorBrain** — multi-agent orchestration with session memory and OAuth handoffs
- **MirrorOrgOS** — governance: workorders, risk classification, board minutes
- **MirrorGate** — privacy/safety proxy for all external AI calls
- **Memory Bus** — cross-agent persistent context, no cloud dependency

Built Feb 2026. Local hardware. No VC. No platform lock-in.

→ [activemirror.ai](https://activemirror.ai)

---

If this resonates, ⭐ the repo.

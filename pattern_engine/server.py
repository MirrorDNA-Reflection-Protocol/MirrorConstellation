#!/usr/bin/env python3
"""
MirrorConstellation Pattern Engine
Runs on port 8203. Classifies text captures using SmolLM3 via Ollama.
Stores data in ~/.mirrordna/mirror/
Logs all outputs to ~/.mirrordna/mirror/audit/
"""

import json
import uuid
import time
import hashlib
from pathlib import Path
from datetime import datetime, timezone
from typing import Optional

from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel
import httpx
import sys as _sys
_sys.path.insert(0, str(Path.home() / ".mirrordna" / "lib"))

from vault_graph import load_vault_graph
from rhythm import compute_rhythm

# --- Config ---
OLLAMA_URL = "http://localhost:11434"
MODEL = "alibayram/smollm3:latest"
CONFIDENCE_THRESHOLD = 0.6
MIRROR_DIR = Path.home() / ".mirrordna" / "mirror"
CAPTURES_DIR = MIRROR_DIR / "captures"
AUDIT_DIR = MIRROR_DIR / "audit"
ARCHETYPES_FILE = MIRROR_DIR / "archetypes.json"

for d in [CAPTURES_DIR, AUDIT_DIR]:
    d.mkdir(parents=True, exist_ok=True)

# --- Known archetypes ---
KNOWN_ARCHETYPES = {
    "builder": {
        "keywords": ["build", "ship", "code", "deploy", "implement", "write", "create", "launch", "fix", "run", "test"],
        "description": "Systems, ships, executes. Satisfaction in function."
    },
    "sovereign": {
        "keywords": ["local", "control", "private", "own", "independent", "sovereign", "secure", "govern", "no dependency"],
        "description": "Control, clarity, no dependency on others for momentum."
    },
    "seeker": {
        "keywords": ["why", "pattern", "understand", "curious", "explore", "theory", "question", "discover", "learn"],
        "description": "Curiosity, pattern recognition, meaning in complexity."
    },
    "witness": {
        "keywords": ["notice", "observe", "reflect", "see", "aware", "present", "feeling", "sense", "today"],
        "description": "Observer, integrator, sees the whole not the part."
    },
    "transmitter": {
        "keywords": ["share", "publish", "post", "tell", "show", "visible", "reach", "communicate", "distribute"],
        "description": "Shares, teaches, visibility through expression."
    },
}

# --- Pydantic models ---
class CaptureRequest(BaseModel):
    text: str
    timestamp: Optional[int] = None

class ConfirmRequest(BaseModel):
    id: str

# --- FastAPI app ---
app = FastAPI(title="MirrorConstellation Pattern Engine", version="0.1.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

# --- WebSocket connection manager ---
class ConnectionManager:
    def __init__(self):
        self.active: list[WebSocket] = []

    async def connect(self, ws: WebSocket):
        await ws.accept()
        self.active.append(ws)

    def disconnect(self, ws: WebSocket):
        if ws in self.active:
            self.active.remove(ws)

    async def broadcast(self, data: dict):
        dead = []
        for ws in self.active:
            try:
                await ws.send_json(data)
            except Exception:
                dead.append(ws)
        for ws in dead:
            self.disconnect(ws)

ws_manager = ConnectionManager()

# Cache for vault graph (expensive to compute)
_graph_cache: Optional[dict] = None
_graph_cache_ts: float = 0
GRAPH_CACHE_TTL = 300  # 5 minutes


def get_cached_graph() -> dict:
    global _graph_cache, _graph_cache_ts
    if _graph_cache is None or (time.time() - _graph_cache_ts) > GRAPH_CACHE_TTL:
        _graph_cache = load_vault_graph()
        _graph_cache_ts = time.time()
    return _graph_cache

# --- Helpers ---
def rule_based_classify(text: str) -> tuple[str, float]:
    """Fast rule-based classifier as primary + fallback."""
    text_lower = text.lower()
    scores: dict[str, float] = {}
    for archetype, config in KNOWN_ARCHETYPES.items():
        hits = sum(1 for kw in config["keywords"] if kw in text_lower)
        scores[archetype] = hits / max(len(config["keywords"]), 1)

    best = max(scores, key=scores.get)  # type: ignore
    raw_score = scores[best]

    # Normalize: 1 keyword hit = 0.55, 2+ = 0.7+
    if raw_score == 0:
        return "witness", 0.35  # default: the witness notices
    confidence = min(0.55 + raw_score * 1.5, 0.95)
    return best, round(confidence, 3)


async def ollama_classify(text: str) -> Optional[tuple[str, float]]:
    """LLM-based classification via Ollama."""
    prompt = f"""You are a pattern recognition system for personal archetypes.

Given this text, classify it into exactly one archetype:
- builder: building, coding, shipping, executing
- sovereign: independence, privacy, local control, no external dependency
- seeker: curiosity, questioning, exploring ideas, learning
- witness: observing, noticing emotions, reflecting, being present
- transmitter: sharing, publishing, reaching others, visibility

Text: "{text}"

Respond with ONLY a JSON object: {{"archetype": "name", "confidence": 0.0-1.0, "reason": "one sentence"}}"""

    try:
        async with httpx.AsyncClient(timeout=8.0) as client:
            resp = await client.post(f"{OLLAMA_URL}/api/generate", json={
                "model": MODEL,
                "prompt": prompt,
                "stream": False,
                "options": {"temperature": 0.1, "num_predict": 80}
            })
            if resp.status_code != 200:
                return None
            raw = resp.json().get("response", "")
            # Extract JSON from response
            start = raw.find("{")
            end = raw.rfind("}") + 1
            if start < 0 or end <= start:
                return None
            data = json.loads(raw[start:end])
            archetype = data.get("archetype", "").lower().strip()
            confidence = float(data.get("confidence", 0.5))
            if archetype not in KNOWN_ARCHETYPES:
                return None
            return archetype, round(confidence, 3)
    except Exception:
        return None


def load_archetypes() -> dict:
    if ARCHETYPES_FILE.exists():
        return json.loads(ARCHETYPES_FILE.read_text())
    return {k: {"count": 0, "last_seen": None, "confirmed": True} for k in KNOWN_ARCHETYPES}


def save_archetypes(data: dict):
    ARCHETYPES_FILE.write_text(json.dumps(data, indent=2))


def audit_log(entry: dict):
    date_str = datetime.now(timezone.utc).strftime("%Y-%m-%d")
    log_file = AUDIT_DIR / f"{date_str}.jsonl"
    with open(log_file, "a") as f:
        f.write(json.dumps(entry) + "\n")


# --- Routes ---
@app.get("/status")
def status():
    return {"ok": True, "model": MODEL, "threshold": CONFIDENCE_THRESHOLD}


@app.post("/capture")
async def capture(req: CaptureRequest):
    ts = req.timestamp or int(time.time() * 1000)
    capture_id = f"cap-{uuid.uuid4().hex[:8]}"

    # Try LLM first, fall back to rule-based
    llm_result = await ollama_classify(req.text)
    if llm_result:
        archetype, confidence = llm_result
        method = "ollama"
    else:
        archetype, confidence = rule_based_classify(req.text)
        method = "rule_based"

    # Load archetype state
    archetypes = load_archetypes()

    # Check if this is a new archetype (shouldn't happen with fixed set, but future-proof)
    is_new_archetype = archetype not in archetypes
    if is_new_archetype:
        archetypes[archetype] = {"count": 0, "last_seen": None, "confirmed": False}

    # Update archetype stats
    if archetype in archetypes:
        archetypes[archetype]["count"] = archetypes[archetype].get("count", 0) + 1
        archetypes[archetype]["last_seen"] = datetime.now(timezone.utc).isoformat()
    save_archetypes(archetypes)

    # Build node label from first 40 chars
    label = req.text.strip()[:40]
    if len(req.text.strip()) > 40:
        label = label.rsplit(" ", 1)[0] + "…"

    # Provenance hash: sha256(text + archetype + ts + method)
    provenance_data = f"{req.text}|{archetype}|{ts}|{method}"
    provenance_hash = hashlib.sha256(provenance_data.encode()).hexdigest()

    result = {
        "id": capture_id,
        "label": label,
        "cluster": archetype,
        "archetype": archetype,
        "confidence": confidence,
        "isNewArchetype": is_new_archetype,
        "rawText": req.text,
        "timestamp": ts,
        "provenance_hash": provenance_hash[:24],
    }

    # Save capture
    capture_file = CAPTURES_DIR / f"{capture_id}.json"
    capture_file.write_text(json.dumps({**result, "method": method}))

    # Broadcast to WebSocket clients
    import asyncio
    try:
        loop = asyncio.get_event_loop()
        if loop.is_running():
            asyncio.ensure_future(ws_manager.broadcast({"type": "new_node", "node": result}))
    except Exception:
        pass

    # Governance audit log
    audit_log({
        "ts": datetime.now(timezone.utc).isoformat(),
        "id": capture_id,
        "archetype": archetype,
        "confidence": confidence,
        "method": method,
        "gated": confidence < CONFIDENCE_THRESHOLD,
        "text_hash": hashlib.sha256(req.text.encode()).hexdigest()[:16],
    })

    return result


@app.get("/archetypes")
def get_archetypes():
    data = load_archetypes()
    nodes = []
    for name, state in data.items():
        if name not in KNOWN_ARCHETYPES:
            continue
        nodes.append({
            "id": f"a-{name}",
            "label": name.capitalize(),
            "type": "archetype" if state.get("confirmed", True) else "pending",
            "confidence": 0.9 if state.get("confirmed", True) else 0.4,
            "strength": min(0.5 + state.get("count", 0) * 0.02, 1.0),
            "cluster": name,
            "description": KNOWN_ARCHETYPES[name]["description"],
        })
    return nodes


@app.post("/confirm")
def confirm_archetype(req: ConfirmRequest):
    archetypes = load_archetypes()
    # Find by id (a-name format) or name
    name = req.id.replace("a-", "")
    if name in archetypes:
        archetypes[name]["confirmed"] = True
        save_archetypes(archetypes)
        audit_log({
            "ts": datetime.now(timezone.utc).isoformat(),
            "action": "confirm_archetype",
            "archetype": name,
        })
        return {"ok": True, "archetype": name}
    return {"ok": False, "error": "not found"}


# --- Phase 4: Governance helpers ---

def load_audit_entries(days: int = 7) -> list:
    entries = []
    cutoff = time.time() - days * 86400
    for log_file in sorted(AUDIT_DIR.glob("*.jsonl"), reverse=True)[:days]:
        try:
            for line in log_file.read_text().splitlines():
                if not line.strip():
                    continue
                entry = json.loads(line)
                ts_str = entry.get("ts", "")
                try:
                    from datetime import datetime as _dt
                    ts = _dt.fromisoformat(ts_str.replace("Z", "+00:00")).timestamp()
                    if ts >= cutoff:
                        entries.append(entry)
                except Exception:
                    entries.append(entry)
        except Exception:
            pass
    return entries


def get_quarantine_nodes() -> list:
    """Captures below confidence threshold — real data, not surfaced by default."""
    quarantine = []
    if not CAPTURES_DIR.exists():
        return quarantine
    for cf in sorted(CAPTURES_DIR.glob("*.json"), key=lambda f: f.stat().st_mtime, reverse=True)[:100]:
        try:
            c = json.loads(cf.read_text())
            if c.get("confidence", 1.0) < CONFIDENCE_THRESHOLD:
                quarantine.append({
                    "id": c["id"],
                    "label": c.get("label", ""),
                    "type": "pending",
                    "confidence": c.get("confidence", 0),
                    "strength": 0.2,
                    "cluster": c.get("archetype", "unknown"),
                    "description": c.get("rawText", ""),
                    "timestamp": c.get("timestamp", 0),
                    "provenance_hash": c.get("provenance_hash", ""),
                })
        except Exception:
            pass
    return quarantine


# --- Phase 3 routes ---

@app.get("/api/constellation/graph")
def constellation_graph():
    """Live vault graph data for Graph mode."""
    graph = get_cached_graph()
    return graph


@app.get("/api/constellation/mirror")
def constellation_mirror():
    """Archetype data for Mirror mode — combines mock archetypes with live captures."""
    archetypes = load_archetypes()
    nodes = []
    for name, state in archetypes.items():
        if name not in KNOWN_ARCHETYPES:
            continue
        nodes.append({
            "id": f"a-{name}",
            "label": name.title(),
            "type": "archetype" if state.get("confirmed", True) else "pending",
            "confidence": 0.9 if state.get("confirmed", True) else 0.4,
            "strength": min(0.5 + state.get("count", 0) * 0.02, 1.0),
            "cluster": name,
            "description": KNOWN_ARCHETYPES[name]["description"],
            "timestamp": time.time() * 1000,
        })
    # Add recent captures as moment nodes
    edges = []
    if CAPTURES_DIR.exists():
        capture_files = sorted(CAPTURES_DIR.glob("*.json"), key=lambda f: f.stat().st_mtime, reverse=True)[:50]
        for cf in capture_files:
            try:
                c = json.loads(cf.read_text())
                confidence = c.get("confidence", 0)
                if confidence < CONFIDENCE_THRESHOLD:
                    node_type = "pending"
                else:
                    node_type = "moment"
                nodes.append({
                    "id": c["id"],
                    "label": c.get("label", ""),
                    "type": node_type,
                    "confidence": confidence,
                    "strength": min(0.3 + confidence * 0.4, 0.8),
                    "cluster": c.get("archetype", "witness"),
                    "description": c.get("rawText", ""),
                    "timestamp": c.get("timestamp", 0),
                })
                archetype_id = f"a-{c.get('archetype', 'witness')}"
                edges.append({"source": archetype_id, "target": c["id"], "strength": confidence * 0.4})
            except Exception:
                pass
    return {"nodes": nodes, "edges": edges}


@app.get("/api/constellation/rhythm")
def constellation_rhythm():
    """Current rhythm and energy state."""
    return compute_rhythm()


@app.get("/api/constellation/audit")
def constellation_audit(days: int = 7):
    """Full governance audit trail — every classification, method, confidence, gate status."""
    entries = load_audit_entries(days)
    summary = {
        "total": len(entries),
        "gated": sum(1 for e in entries if e.get("gated")),
        "confirmed": sum(1 for e in entries if e.get("action") == "confirm_archetype"),
        "by_method": {},
        "by_archetype": {},
    }
    for e in entries:
        m = e.get("method", "unknown")
        a = e.get("archetype", "unknown")
        summary["by_method"][m] = summary["by_method"].get(m, 0) + 1
        summary["by_archetype"][a] = summary["by_archetype"].get(a, 0) + 1
    return {"entries": entries[-50:], "summary": summary}


@app.get("/api/constellation/quarantine")
def get_quarantine():
    """Nodes below confidence threshold — accessible but not surfaced by default."""
    return {"nodes": get_quarantine_nodes(), "threshold": CONFIDENCE_THRESHOLD}


@app.get("/api/constellation/provenance/{capture_id}")
def get_provenance(capture_id: str):
    """Full provenance chain for a single capture."""
    capture_file = CAPTURES_DIR / f"{capture_id}.json"
    if not capture_file.exists():
        return {"error": "not found"}
    data = json.loads(capture_file.read_text())
    return {
        "id": capture_id,
        "archetype": data.get("archetype"),
        "confidence": data.get("confidence"),
        "method": data.get("method"),
        "timestamp": data.get("timestamp"),
        "provenance_hash": data.get("provenance_hash", ""),
        "text_hash": hashlib.sha256(data.get("rawText", "").encode()).hexdigest()[:16],
        "audit_entries": [e for e in load_audit_entries(30) if e.get("id") == capture_id],
    }


@app.get("/api/memory-graph")
def memory_graph():
    """Live agent memory as nodes + edges for memory-graph visualization."""
    # Read from file-based memory sources (no DB dependency)
    memories = []
    recall_dir = Path.home() / ".mirrordna" / "mirrorrecall" / "sessions"
    if recall_dir.exists():
        for f in sorted(recall_dir.glob("*.json"), reverse=True)[:60]:
            try:
                s = json.loads(f.read_text())
                memories.append({
                    "id": f.stem,
                    "agent": s.get("agent", "claude-code"),
                    "source": s.get("source", "session-commit"),
                    "content": s.get("summary", s.get("content", "")),
                    "summary": s.get("summary", "")[:80],
                    "created_at": s.get("timestamp", ""),
                    "tags": s.get("tags", []),
                })
            except Exception:
                pass

    nodes = [
        {"id": "paul",        "label": "Paul (Anchor)",     "type": "agent",   "size": 24},
        {"id": "claude-code", "label": "Claude Code",       "type": "agent",   "size": 20},
        {"id": "antigravity", "label": "Antigravity (AG)",  "type": "agent",   "size": 18},
    ]
    links = [
        {"source": "paul", "target": "claude-code", "strength": 2},
        {"source": "paul", "target": "antigravity",  "strength": 1.5},
        {"source": "claude-code", "target": "antigravity", "strength": 1},
    ]

    seen_ids = {"paul", "claude-code", "antigravity"}
    project_keywords = {
        "mirrorconstellation": "MirrorConstellation",
        "mirrorbrain": "MirrorBrain",
        "mirrororgos": "MirrorOrgOS",
        "mirrorgraph": "MirrorGraph",
        "mirrorgat": "MirrorGate",
        "mirrorbalance": "MirrorBalance",
        "beacon": "Beacon",
        "mirrorself": "MirrorSelf",
        "mirrorradar": "MirrorRadar",
        "activemirror": "ActiveMirror",
    }
    project_nodes: dict = {}

    for m in memories:
        mem_id  = f"mem-{(m.get('id') or m.get('created_at','?'))}"[:24]
        agent   = m.get("agent", "claude-code")
        source  = m.get("source", "")
        summary = (m.get("summary") or m.get("content", ""))[:60]
        ts      = m.get("created_at", "")

        node_type = "conversation"
        if source == "ship":
            node_type = "ki"
        elif source in ("session-end-ship", "session-end-auto"):
            node_type = "conversation"

        size = 12 if node_type == "conversation" else 10
        if mem_id not in seen_ids:
            nodes.append({"id": mem_id, "label": summary, "type": node_type,
                          "size": size, "ts": str(ts)[:16]})
            seen_ids.add(mem_id)
            links.append({"source": agent if agent in seen_ids else "claude-code",
                          "target": mem_id, "strength": 0.6})

        # Detect project references
        content_lower = (m.get("content", "") + " " + summary).lower()
        for kw, proj_label in project_keywords.items():
            if kw in content_lower:
                proj_id = f"proj-{kw}"
                if proj_id not in project_nodes:
                    project_nodes[proj_id] = proj_label

    for proj_id, proj_label in project_nodes.items():
        if proj_id not in seen_ids:
            nodes.append({"id": proj_id, "label": proj_label, "type": "project", "size": 16})
            seen_ids.add(proj_id)
            links.append({"source": "paul", "target": proj_id, "strength": 1})

    return {"nodes": nodes, "links": links,
            "meta": {"total": len(nodes), "memories": len(memories)}}


MEMORY_GRAPH_HTML = Path(__file__).parent.parent.parent / "repos" / "memory-graph" / "index.html"

@app.get("/memory-graph")
def serve_memory_graph():
    """Serve the memory-graph visualization HTML."""
    html_path = Path.home() / "repos" / "memory-graph" / "index.html"
    if html_path.exists():
        return FileResponse(str(html_path), media_type="text/html")
    return {"error": "memory-graph not found"}


@app.websocket("/ws/constellation")
async def websocket_constellation(ws: WebSocket):
    """Real-time node updates. Sends new nodes as they're classified."""
    await ws_manager.connect(ws)
    try:
        while True:
            # Keep alive — client can send pings
            data = await ws.receive_text()
            if data == "ping":
                await ws.send_text("pong")
    except WebSocketDisconnect:
        ws_manager.disconnect(ws)


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="127.0.0.1", port=8203, log_level="warning")

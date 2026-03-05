#!/usr/bin/env python3
"""
rhythm.py — Rhythm Sensor

Analyzes interaction timestamps to infer energy, cadence, and patterns.
Data sources:
- ~/.mirrordna/mirror/captures/  (constellation captures)
- ~/.mirrordna/bus/cc_events.jsonl (CC session events)
"""

import json
import time
from pathlib import Path
from datetime import datetime, timezone
from collections import Counter

MIRROR_DIR = Path.home() / ".mirrordna" / "mirror"
EVENTS_FILE = Path.home() / ".mirrordna" / "bus" / "cc_events.jsonl"
CAPTURES_DIR = MIRROR_DIR / "captures"


def load_capture_timestamps() -> list[float]:
    ts_list = []
    if not CAPTURES_DIR.exists():
        return ts_list
    for f in CAPTURES_DIR.glob("*.json"):
        try:
            data = json.loads(f.read_text())
            ts = data.get("timestamp", 0)
            if ts > 1e12:  # milliseconds → seconds
                ts /= 1000
            if ts > 0:
                ts_list.append(ts)
        except Exception:
            pass
    return sorted(ts_list)


def load_session_timestamps() -> list[float]:
    ts_list = []
    if not EVENTS_FILE.exists():
        return ts_list
    try:
        with open(EVENTS_FILE) as f:
            for line in f:
                try:
                    entry = json.loads(line.strip())
                    ts = entry.get("ts", entry.get("timestamp", 0))
                    if isinstance(ts, str):
                        from datetime import datetime
                        dt = datetime.fromisoformat(ts.replace("Z", "+00:00"))
                        ts = dt.timestamp()
                    if ts and ts > 0:
                        ts_list.append(float(ts))
                except Exception:
                    pass
    except Exception:
        pass
    return sorted(ts_list)


def compute_rhythm() -> dict:
    now = time.time()
    capture_ts = load_capture_timestamps()
    session_ts = load_session_timestamps()
    all_ts = sorted(capture_ts + session_ts)

    # Days since last capture
    last_capture = capture_ts[-1] if capture_ts else None
    days_since_last = (now - last_capture) / 86400 if last_capture else 999

    # Recent activity (last 7 days)
    week_ago = now - 7 * 86400
    recent_events = [t for t in all_ts if t > week_ago]
    events_per_day = len(recent_events) / 7

    # Time-of-day distribution (hour buckets)
    hour_dist: Counter = Counter()
    for ts in all_ts[-200:]:  # last 200 events
        hour = datetime.fromtimestamp(ts).hour
        hour_dist[hour] += 1

    # Peak hour
    peak_hour = hour_dist.most_common(1)[0][0] if hour_dist else 9

    # Current hour energy based on peak pattern
    current_hour = datetime.now().hour
    hour_score = hour_dist.get(current_hour, 0) / max(max(hour_dist.values(), default=1), 1)

    # Energy inference
    if hour_score > 0.5 or events_per_day > 10:
        energy = "high"
    elif hour_score > 0.2 or events_per_day > 3:
        energy = "medium"
    else:
        energy = "low"

    # Cadence pattern
    if days_since_last < 1:
        cadence = "active"
    elif days_since_last < 3:
        cadence = "regular"
    elif days_since_last < 7:
        cadence = "intermittent"
    else:
        cadence = "dormant"

    # Constellation physics modifier
    # High energy → expanded constellation (nodes spread further)
    # Low energy → contracted (nodes cluster tighter)
    physics_modifier = {"high": 1.3, "medium": 1.0, "low": 0.7}[energy]

    return {
        "energy": energy,
        "cadence": cadence,
        "days_since_last_capture": round(days_since_last, 1),
        "events_per_day_7d": round(events_per_day, 1),
        "peak_hour": peak_hour,
        "current_hour": current_hour,
        "hour_score": round(hour_score, 3),
        "physics_modifier": physics_modifier,
        "total_captures": len(capture_ts),
        "hour_distribution": dict(sorted(hour_dist.items())),
        "ts": now,
    }


if __name__ == "__main__":
    r = compute_rhythm()
    print(json.dumps(r, indent=2))

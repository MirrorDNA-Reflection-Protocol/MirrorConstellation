#!/usr/bin/env python3
"""
vault_graph.py — Vault → Constellation graph parser

Reads ~/MirrorDNA-Vault notes with mirror_id + mirror_links frontmatter.
Returns top N nodes by connection count as constellation data.
Scans only live sections: 01_ACTIVE, 04_REFERENCE, 10_COMPRESSIONS.
"""

import re
import json
from pathlib import Path
from collections import defaultdict

VAULT_ROOT = Path.home() / "MirrorDNA-Vault"
SCAN_DIRS = ["01_ACTIVE", "04_REFERENCE", "10_COMPRESSIONS", "Papers"]
MAX_NODES = 300
MAX_EDGES = 600

# Section → cluster mapping
FOLDER_CLUSTERS = {
    "MirrorGate":      "governance",
    "SovereignFactory": "infra",
    "ActiveMirror":    "surface",
    "MirrorBrain":     "ai",
    "MirrorBalance":   "concepts",
    "Protocols":       "governance",
    "Corpora":         "concepts",
    "Papers":          "surface",
    "System":          "infra",
    "MirrorSeed":      "surface",
    "MirrorConstellation": "surface",
    "GlyphOS":         "ai",
    "Kavach":          "governance",
    "Organism":        "ai",
    "MirrorGraph":     "concepts",
}

CLUSTER_COLORS = {
    "governance": "#a855f7",
    "infra":      "#3b82f6",
    "surface":    "#00ff94",
    "ai":         "#00d4ff",
    "concepts":   "#ffd700",
    "core":       "#00ff94",
}


def detect_cluster(path: Path) -> str:
    parts = path.parts
    for part in reversed(parts):
        for key, cluster in FOLDER_CLUSTERS.items():
            if key.lower() in part.lower():
                return cluster
    return "core"


def parse_frontmatter(text: str) -> dict:
    if not text.startswith("---"):
        return {}
    end = text.find("---", 3)
    if end < 0:
        return {}
    yaml_block = text[3:end].strip()
    result = {}
    # Simple YAML parser for the fields we need
    current_key = None
    current_list = None
    for line in yaml_block.splitlines():
        if not line.strip() or line.strip().startswith("#"):
            continue
        if line.startswith("  - ") or line.startswith("- "):
            val = line.strip().lstrip("- ").strip()
            if current_list is not None:
                try:
                    current_list.append(int(val))
                except ValueError:
                    current_list.append(val)
            continue
        if ":" in line:
            key, _, val = line.partition(":")
            key = key.strip()
            val = val.strip()
            current_key = key
            current_list = None
            if val == "" or val == "[]":
                # list follows
                result[key] = []
                current_list = result[key]
            elif val.startswith("[") and val.endswith("]"):
                inner = val[1:-1]
                result[key] = [int(x.strip()) for x in inner.split(",") if x.strip().lstrip("-").isdigit()]
            else:
                try:
                    result[key] = int(val)
                except ValueError:
                    result[key] = val.strip('"\'')
    return result


def load_vault_graph(max_nodes: int = MAX_NODES) -> dict:
    """
    Returns {"nodes": [...], "edges": [...]} in ConstellationData format.
    """
    nodes_raw = {}  # mirror_id → {label, path, cluster, tags, layer}
    edges_raw = []  # (source_id, target_id)

    for section in SCAN_DIRS:
        section_path = VAULT_ROOT / section
        if not section_path.exists():
            continue
        for md_file in section_path.rglob("*.md"):
            try:
                text = md_file.read_text(encoding="utf-8", errors="ignore")
            except Exception:
                continue

            fm = parse_frontmatter(text)
            mirror_id = fm.get("mirror_id")
            if not mirror_id:
                continue

            label = md_file.stem.replace("_", " ").replace("-", " ")
            # Use title from frontmatter or first H1
            title_match = re.search(r'^#\s+(.+)$', text, re.MULTILINE)
            if title_match:
                label = title_match.group(1).strip()[:50]

            cluster = detect_cluster(md_file)
            tags = fm.get("tags", [])
            if isinstance(tags, str):
                tags = [tags]

            links = fm.get("mirror_links", [])

            nodes_raw[mirror_id] = {
                "id": f"v-{mirror_id}",
                "raw_id": mirror_id,
                "label": label,
                "cluster": cluster,
                "tags": tags,
                "layer": fm.get("layer", "active"),
                "link_count": len(links),
                "links": links,
                "path": str(md_file.relative_to(VAULT_ROOT)),
            }

    # Sort by connection count, take top N
    sorted_nodes = sorted(nodes_raw.values(), key=lambda n: n["link_count"], reverse=True)[:max_nodes]
    kept_ids = {n["raw_id"] for n in sorted_nodes}

    # Build edges (only between kept nodes)
    edge_set = set()
    for node in sorted_nodes:
        for link_id in node["links"]:
            if link_id in kept_ids and link_id != node["raw_id"]:
                key = tuple(sorted([node["raw_id"], link_id]))
                if key not in edge_set:
                    edge_set.add(key)
                    edges_raw.append(key)
                    if len(edges_raw) >= MAX_EDGES:
                        break
        if len(edges_raw) >= MAX_EDGES:
            break

    # Compute max link count for normalization
    max_links = max((n["link_count"] for n in sorted_nodes), default=1)

    # Build constellation nodes
    nodes_out = []
    for node in sorted_nodes:
        strength = min(node["link_count"] / max(max_links, 1), 1.0)
        node_type = "archetype" if node["link_count"] > max_links * 0.6 else \
                    "concept" if node["link_count"] > max_links * 0.3 else \
                    "project" if node["cluster"] in ("surface", "infra") else "moment"
        nodes_out.append({
            "id": node["id"],
            "label": node["label"],
            "type": node_type,
            "confidence": 0.9 if node["layer"] == "canonical" else 0.8,
            "strength": round(0.3 + strength * 0.7, 3),
            "cluster": node["cluster"],
            "tags": node["tags"],
            "description": node["path"],
        })

    edges_out = []
    id_map = {n["raw_id"]: n["id"] for n in sorted_nodes}
    for (a, b) in edges_raw:
        if a in id_map and b in id_map:
            edges_out.append({
                "source": id_map[a],
                "target": id_map[b],
                "strength": 0.4,
            })

    return {"nodes": nodes_out, "edges": edges_out}


if __name__ == "__main__":
    g = load_vault_graph()
    print(f"Nodes: {len(g['nodes'])}, Edges: {len(g['edges'])}")
    print("Top 5:", [n["label"] for n in g["nodes"][:5]])

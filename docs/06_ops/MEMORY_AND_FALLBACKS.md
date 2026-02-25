# MEMORY AND WEB FALLBACKS

Stand: 2026-02-25

## 1) Shared Memory Baseline (M1/M5)

### Rollen

- `wanda-memory` MCP:
  - Source of truth fuer AI-Memory (`SQLite + FAISS`).
  - Tools: `wanda_remember`, `wanda_recall`, `wanda_forget`, `wanda_manifest`.
- `wanda-hub` MCP:
  - Ops/Automation-Layer (Brave/Jina/Infra/Git/etc.).
  - Kein Ersatz fuer den zentralen Memory-Store.
- Markdown-Memory (`.gemini/*.md`, Projekt-Dokus):
  - Human-readable, Git-friendly Wissensschicht.
  - Architektur-/Produktentscheidungen, keine semantische Recall-Engine.

### Transport-Standard

Alle 3 Clients sprechen denselben `stdio`-Server:

- Codex: `/home/jannis/.codex/config.toml` → `wanda-memory` via `start_memory_server.sh codex`
- Gemini: `/home/jannis/.gemini/settings.json` + enablement → `start_memory_server.sh gemini`
- Claude: `/home/jannis/.claude/settings.json` → `start_memory_server.sh claude`

`start_memory_server.sh` setzt `WANDA_SOURCE_AI`, damit `source_ai` sauber pro Client geschrieben wird.

## 2) Validierung (M2/M3/M4/M6)

- Code/Syntax:
  - `cd /home/jannis/Schreibtisch/Work-OS/40_Products/Wanda-DocScraper`
  - `./.venv/bin/python -m py_compile memory_core.py memory_mcp_server.py`
- End-to-end:
  - `./scripts/validate_memory_e2e.sh`

Was der E2E-Test absichert:

- Vector refresh bei `update/replace` (kein stale recall).
- `source_ai` Persistenz fuer `codex|gemini|claude`.
- `remember/recall/forget/manifest` funktionieren.

## 3) Web-Fallback Strategy (M7/G7)

Prioritaet:

1. Brave (wenn API verfuegbar, schnellste Web-Suche)
2. Jina Reader (schneller URL->Markdown Zugriff)
3. SearXNG auf VPS (resilientes Meta-Search Fallback)

### Runtime-Check

- Script: `/home/jannis/Schreibtisch/Work-OS/40_Products/scripts/validate_web_fallbacks.sh`
- Master Validation: `scripts/validate_basics_all.sh` ruft den Check mit auf.

Stand vom Check (2026-02-25):

- Jina Reader: erreichbar.
- SearXNG: Container `wanda-searxng` auf `vps` erreichbar, JSON-Suche liefert Ergebnisse.
- Brave: optional, nur wenn `BRAVE_API_KEY` gesetzt.

## 4) Memory Roadmap (M8)

Phasen fuer den naechsten Ausbau:

1. SQLite Memory (bereits aktiv, weiter haerten)
2. Knowledge Graph Layer (Entity-Relationen + Traversal)
3. Context Pruning (`/compact`, Auto-Summarize)
4. Multimodal Memory (Bild/Audio/Video/Dokument-Ingest)
5. Self-Evolving Memory (Decay, dedupe, Reorg)
6. Markdown Overlay als Audit-/Review-Schicht

Regel:

- Operativer Recall bleibt in `wanda-memory`.
- Produkt-/Architekturwissen bleibt zusaetzlich in Markdown-SSOT.

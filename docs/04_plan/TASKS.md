# TASKS - WANDA Messaging + Memory Final

Stand: 2026-02-25
Master-Board: `/home/jannis/Schreibtisch/Work-OS/40_Products/BASICS_MASTER_TASKS.md`

## Ziel

Telegram und Discord als produktive Remote-Channels plus ein valides, gemeinsames Memory-System fuer Codex, Gemini und Claude.

## Aufgaben - Messaging

- [x] `T1` Shared Runtime bauen (`providers`, `models`, Session-State, Chat-Adapter)
- [x] `T2` Telegram refactor: Kontext pro Chat, Inline-Keyboard, `/provider`, `/model`, `/reset`
- [x] `T3` Telegram Voice-Flow: Voice empfangen, sinnvolle Antwort + optionaler STT-Hook
- [x] `T4` Telegram Group-Mode: nur bei Mention/Reply reagieren (Spam-Schutz)
- [x] `T5` Discord Bot neu aufsetzen mit `discord.js`
- [x] `T6` Discord Slash Commands: `/provider`, `/model`, `/ask`, `/reset`, `/status`
- [x] `T7` Discord Features: Reactions, Thread-Replies, Embed-Output, Voice-Presence Events
- [x] `T8` Konfig vereinheitlichen (`.env`-basiert, gleiche Provider-Definition fuer beide Bots)
- [x] `T9` Startup/Runbook dokumentieren
- [x] `T10` Validierung: Syntaxchecks, Dry-Run der Command-Parser, Fehlerpfade
- [x] `T11` VOX Voice Bridge integrieren (`vox transcribe` oder Webhook, inkl. Status-Commands)
- [x] `T12` Repo-Readiness-Pack fuer eigenstaendiges Production-Repo abschliessen

## Aufgaben - Memory System

- [x] `M1` Ist-Analyse dokumentieren: Markdown-Memory vs. SharedMemory (SQLite+FAISS) vs. Hub-Tools
- [x] `M2` SharedMemory-Core fixen: Similarity-Berechnung und Vector-Refresh bei Update/Replace
- [x] `M3` `memory_mcp_server` verbessern: `source_ai` sauber pro Client (arg/env), klare Fehlerausgaben
- [x] `M4` Clients angleichen: Codex, Gemini, Claude auf denselben Shared-Memory-Transport bringen
- [x] `M5` Hub-Memory-Strategie festziehen: Rollen von `wanda-hub` vs. `wanda-memory` explizit machen
- [x] `M6` Validierung End-to-End: remember/recall/forget/manifest fuer alle KIs (soweit lokal testbar)
- [x] `M7` VPS-Check: SearXNG Status/Endpoint pruefen und als Fallback sauber dokumentieren
- [x] `M8` Memory-Roadmap einpflegen: SQLite, Knowledge Graph, Pruning, Multimodal, Self-Evolving, Markdown-Layer

## Akzeptanzkriterien - Messaging

- [x] Provider/Model pro Channel/Chat wechselbar ohne Neustart
- [x] Telegram reagiert nicht mehr "dumm": Kontext bleibt erhalten, Antworten sind koharent
- [x] Discord Slash Commands arbeiten stabil und sichtbar (Ack/Status/Fehler klar)
- [x] Beide Bots nutzen denselben Runtime-Layer
- [x] VOX Voice ist als STT-Bridge anschliessbar (CLI oder Webhook)

## Akzeptanzkriterien - Memory

- [x] SharedMemory-Quelle ist eindeutig und von allen 3 KIs nutzbar
- [x] Memory-Schreibvorgaenge landen nicht mehr pauschal unter `source_ai=claude`
- [x] Recall-Ergebnisse sind qualitativ plausibel (kein Threshold-Drift durch falsche Distanzformel)
- [x] Dokumentierter Fallback fuer Web-Recherche (Brave/Jina/SearXNG) ist vorhanden

## Validierungsnotiz

- [x] Syntaxcheck fuer geaenderte JS-Dateien (`node --check`)
- [x] OAuth-Bridge Smoke-Test (`wanda auth status`)
- [x] VOX-CLI Smoke-Test (`healthCheck` via `shared/vox-cli`)
- [x] Memory-E2E (`Wanda-DocScraper/scripts/validate_memory_e2e.sh`)
- [x] VPS-Fallback-Check (`scripts/validate_web_fallbacks.sh`)

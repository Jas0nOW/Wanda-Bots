# HANDOFF - WANDA Bots

Stand: 2026-02-25

## Was gebaut wurde

- Shared Runtime fuer beide Channels
- Telegram Bot mit Session-Kontext, Controls, OAuth- und VOX-Kommandos
- Discord Bot mit Slash-Commands, Reactions, Thread/Mention-Handling und Voice Presence Logs
- OAuth-Bruecke ueber bestehendes `wanda` CLI
- VOX-Bruecke fuer Telegram Voice via `vox transcribe`
- Shared-Memory-Baseline fuer Codex/Gemini/Claude inklusive `source_ai`-Tagging und E2E-Validierung
- Web-Fallback-Runbook fuer Brave/Jina/SearXNG inklusive VPS-Check

## Start-Kommandos

- Telegram: `cd telegram && npm start`
- Discord: `cd discord && npm start`

## Kritische ENV Variablen

- `TELEGRAM_BOT_TOKEN`
- `DISCORD_BOT_TOKEN`
- `WANDA_CLI_BIN` (optional, default auf `-Wanda-/wanda`)
- `WANDA_CLI_ENABLED` (`true|false`)
- `VOX_CLI_BIN` (optional, default auf `Vox-Voice/.venv/bin/python3`)
- `VOX_STT_MODE` (`cli|webhook`)
- `VOX_STT_WEBHOOK_URL` (bei Webhook-Mode)

## Bekannte Restriktionen

- OAuth Login via Bot triggert lokalen Browser-Flow auf Hostsystem.
- `wanda model select` ist global im bestehenden CLI-Store; parallele Multi-User Nutzung braucht spaeter isolierte Account-Routing-Strategie.

# WANDA Bots
**Repo:** [https://github.com/Jas0nOW/Wanda-Bots](https://github.com/Jas0nOW/Wanda-Bots)

Remote control channels for WANDA with shared runtime, OAuth bridge, and VOX voice integration.

## Channels

- Telegram (`telegram/bot.js`)
- Discord (`discord/bot.js`)

Both channels share provider/model switching and context runtime from `shared/`.

## Core Features

- Provider/model switching per chat/thread (`/provider`, `/model`)
- Persistent in-memory context per channel key
- OAuth bridge to existing `-Wanda-` CLI (`auth status/login/logout`)
- Optional `wanda-cli` provider (model refs like `gemini/oauth/...`)
- VOX integration for Telegram voice transcription (`VOX_STT_MODE=cli`)

## Quick Start

1. Configure environment in `telegram/.env` and `discord/.env` (or `.env.example`).
2. Telegram: `cd telegram && npm install && npm start` (or `node bot.js`).
3. Discord: `cd discord && npm install && npm start`.

## Debug Mode

- Telegram debug: `./scripts/start_telegram_debug.sh`
- Discord debug: `./scripts/start_discord_debug.sh`

`WANDA_DEBUG=1` aktiviert strukturierte Debug-Ausgaben fuer Bridges und Channel-Events.

## Validation

- Full basics validation: `./scripts/validate_basics.sh`

## Docs

- Project SSOT: `docs/00_overview/PROJECT.md`
- Tasks: `docs/04_plan/TASKS.md`
- Milestones: `docs/04_plan/MILESTONES.md`
- Handoff: `docs/04_plan/HANDOFF.md`

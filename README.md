<div align="center">

# WANDA Bots

**Telegram and Discord control surfaces for the WANDA ecosystem**

[![Status](https://img.shields.io/badge/status-active-brightgreen)](./docs/04_plan/HANDOFF.md)
[![Node](https://img.shields.io/badge/node-18%2B-green)](./telegram/package.json)
[![License](https://img.shields.io/badge/license-MIT-green)](./LICENSE)

</div>

WANDA Bots provides remote control channels for WANDA via Telegram and Discord.  
Both bot runtimes share provider routing, debug tooling, and bridge integration from the `shared/` layer.

## What You Get

- Multi-channel bot runtime (`telegram/` and `discord/`)
- Shared provider/model routing (`shared/provider-config.js`)
- Shared bridge helpers for WANDA and Vox
- Debug and validation scripts for fast ops checks

## Repository Layout

| Path | Purpose |
| --- | --- |
| `telegram/` | Telegram bot runtime and package config |
| `discord/` | Discord bot runtime and package config |
| `shared/` | Shared runtime, debug and bridge helpers |
| `scripts/` | Debug launchers and validation checks |
| `docs/` | Project, milestones, handoff and ops docs |

## Quick Start

```bash
# Telegram
cd telegram
npm install
npm run start
```

```bash
# Discord
cd discord
npm install
npm run start
```

## Validation

```bash
./scripts/validate_basics.sh
./scripts/start_telegram_debug.sh
./scripts/start_discord_debug.sh
```

## Configuration

- Create `.env` files in `telegram/` and `discord/`
- Add bot tokens and bridge endpoint variables
- Keep credentials local and out of git

## Documentation

- [Project Overview](./docs/00_overview/PROJECT.md)
- [Tasks](./docs/04_plan/TASKS.md)
- [Milestones](./docs/04_plan/MILESTONES.md)
- [Handoff](./docs/04_plan/HANDOFF.md)
- [Debug and Validate](./docs/06_ops/DEBUG_AND_VALIDATE.md)

## License

MIT. See [LICENSE](./LICENSE).

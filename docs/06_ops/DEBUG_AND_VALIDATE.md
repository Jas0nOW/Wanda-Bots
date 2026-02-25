# DEBUG AND VALIDATE

Stand: 2026-02-25

## Debug Start

- Telegram: `./scripts/start_telegram_debug.sh`
- Discord: `./scripts/start_discord_debug.sh`

`WANDA_DEBUG=1` aktiviert strukturierte Debug-Logs fuer Channel, OAuth-Bridge und VOX-Bridge.

## Validate

- Komplett: `./scripts/validate_basics.sh`
- Global inkl. Web-Fallbacks: `cd ../ && ./scripts/validate_basics_all.sh`
- Memory E2E: `cd ../Wanda-DocScraper && ./scripts/validate_memory_e2e.sh`
- Einzelchecks:
  - `cd telegram && npm run validate`
  - `cd discord && npm run validate`

# PROJECT - WANDA Bots

Stand: 2026-02-25

## Zweck

WANDA Bots ist der Remote-Control Layer fuer WANDA. Telegram und Discord steuern denselben Runtime- und Provider-Stack.

## Architektur

- `shared/provider-config.js`: einheitliche Provider/Model-Konfiguration
- `shared/runtime.js`: Session-Kontext, Provider-/Model-Switching
- `shared/wanda-cli.js`: OAuth-Bridge zum bestehenden `-Wanda-` Token-/Router-System
- `shared/vox-cli.js`: VOX-Bridge fuer CLI-basierte Voice-Transkription
- `telegram/bot.js`: Telegram Channel inklusive Voice-Ingress
- `discord/bot.js`: Discord Channel inkl. Slash-Commands, Threads, Reactions

## Integrationspunkte

- OAuth Source of Truth: `/home/jannis/Schreibtisch/Work-OS/40_Products/-Wanda-/wanda`
- Voice Source of Truth: `/home/jannis/Schreibtisch/Work-OS/40_Products/Vox-Voice`

## Nicht-Ziele

- Kein duplizierter OAuth-Stack in `Wanda-Bots`
- Kein separater Memory-Store pro Channel (Shared-Memory wird projektuebergreifend verwaltet)

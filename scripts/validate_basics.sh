#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

echo "[wanda-bots] syntax checks"
node --check shared/debug.js
node --check shared/provider-config.js
node --check shared/runtime.js
node --check shared/wanda-cli.js
node --check shared/vox-cli.js
node --check telegram/bot.js
node --check discord/bot.js

echo "[wanda-bots] oauth bridge smoke"
node -e "const {authStatus}=require('./shared/wanda-cli'); authStatus().then(()=>process.exit(0)).catch((e)=>{console.error(e.message); process.exit(1);});"

echo "[wanda-bots] vox bridge smoke"
node -e "const {healthCheck}=require('./shared/vox-cli'); healthCheck().then((ok)=>{if(!ok) process.exit(1);}).catch((e)=>{console.error(e.message); process.exit(1);});"

echo "[wanda-bots] validate: OK"

<div align="center">
  <h1>🤖 WANDA Bots</h1>
  <p><strong>The Remote Control Interfaces for the WANDA Ecosystem.</strong></p>
  <a href="https://github.com/Jas0nOW/Wanda-Bots">View Repository</a>
</div>

---

WANDA Bots provides the off-site, remote communication channels for the WANDA ecosystem. Through seamless integration with Telegram and Discord, these bots act as the literal "Remote Control" for the AI, allowing users to interact with their agent, trigger skills, and persist memory from any device, anywhere.

These bots leverage the shared WANDA runtime and seamlessly utilize the authenticated OAuth bridge provided by the Central Hub.

## ✨ Key Features

- **Multi-Channel Architecture:** Native integrations for both Telegram (`telegram/bot.js`) and Discord (`discord/bot.js`).
- **Dynamic Context runtime:** Both channels share provider/model switching logic and context execution directly imported from the `shared/` directory.
- **On-the-Fly Configuration:** Switch between AI providers (Gemini, Anthropic, local) and models dynamically within the chat using slash commands (`/provider`, `/model`).
- **OAuth Bridge integration:** Seamlessly connects to the WANDA system's Google OAuth flow (via `auth status/login/logout`).
- **VOX Voice Integration:** Natively understands and transcribes Telegram Voice Messages leveraging the Vox-Voice STT pipelines.

## 🚀 Quick Start

1. **Configuration:** Copy the respective `.env.example` file to `.env` in both the `telegram/` and `discord/` folders. Add your API keys (e.g., Telegram Bot Token).
2. **Start Telegram Bot:**
   ```bash
   cd telegram
   npm install
   npm start
   ```
3. **Start Discord Bot:**
   ```bash
   cd discord
   npm install
   npm start
   ```

## 🐛 Debugging & Validation

### Start with Debugging Enabled
```bash
# Telegram debug
./scripts/start_telegram_debug.sh

# Discord debug
./scripts/start_discord_debug.sh
```
Setting `WANDA_DEBUG=1` provides structured debug logs for bridge connections and channel events.

### System Validation
```bash
# Run the complete basics test suite
./scripts/validate_basics.sh
```

## 📚 Technical Documentation

For an in-depth look into the bot logic and upcoming milestone goals:

- [Project SSOT](docs/00_overview/PROJECT.md)
- [Active Tasks](docs/04_plan/TASKS.md)
- [Milestones & Roadmap](docs/04_plan/MILESTONES.md)
- [Handoff State](docs/04_plan/HANDOFF.md)

---
*Built under the JANNIS PROTOCOL — Code Must Be Tested, Efficient, and Secure.*

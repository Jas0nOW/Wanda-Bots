require("dotenv").config();
const fs = require("node:fs/promises");
const os = require("node:os");
const path = require("node:path");
const axios = require("axios");
const { Bot, InlineKeyboard } = require("grammy");
const { GoogleGenAI } = require("@google/genai");
const { resolveProviderConfig } = require("../shared/provider-config");
const { ChannelRuntime } = require("../shared/runtime");
const { debug } = require("../shared/debug");
const {
  authStatus: wandaAuthStatus,
  authLogin: wandaAuthLogin,
  authLogout: wandaAuthLogout,
  testModel: wandaTestModel,
} = require("../shared/wanda-cli");
const { hasVoxCli, transcribeAudioFile } = require("../shared/vox-cli");

const TELEGRAM_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
if (!TELEGRAM_TOKEN) {
  console.error("Missing TELEGRAM_BOT_TOKEN");
  process.exit(1);
}

const providerConfig = resolveProviderConfig(process.env);
const bot = new Bot(TELEGRAM_TOKEN);
const geminiClients = new Map();
debug("telegram", "provider-config", {
  providers: Object.keys(providerConfig.providers),
  defaultProvider: providerConfig.defaultProvider,
});

const systemInstruction =
  process.env.WANDA_SYSTEM_PROMPT ||
  [
    "Du bist WANDA.",
    "Antworte kurz, praezise, direkt und loesungsorientiert.",
    "Merke dir den Chat-Kontext innerhalb der Session.",
    "Bei Unsicherheit benenne klar, was fehlt.",
  ].join(" ");

async function geminiAdapter({ model, systemPrompt, history, userInput, provider }) {
  const apiKey = provider.apiKey || process.env.GOOGLE_API_KEY;
  if (!apiKey) throw new Error("GOOGLE_API_KEY is missing for Gemini provider.");
  if (!geminiClients.has(apiKey)) {
    geminiClients.set(apiKey, new GoogleGenAI({ apiKey }));
  }
  const ai = geminiClients.get(apiKey);

  const contents = history.map((item) => ({
    role: item.role === "assistant" ? "model" : "user",
    parts: [{ text: item.content }],
  }));
  contents.push({ role: "user", parts: [{ text: userInput }] });

  const response = await ai.models.generateContent({
    model,
    contents,
    config: {
      systemInstruction: systemPrompt || systemInstruction,
      temperature: provider.temperature ?? 0.2,
    },
  });

  const text = (response.text || "").trim();
  if (!text) throw new Error("Gemini returned no text.");
  return text;
}

async function openAIAdapter({ model, systemPrompt, history, userInput, provider }) {
  const baseUrl = (provider.baseUrl || "https://api.openai.com/v1").replace(/\/+$/, "");
  const apiKey = provider.apiKey || process.env.OPENAI_API_KEY || "";
  if (!apiKey) {
    throw new Error(`Missing API key for provider '${provider.name}'.`);
  }

  const messages = [{ role: "system", content: systemPrompt }];
  for (const item of history) messages.push({ role: item.role, content: item.content });
  messages.push({ role: "user", content: userInput });

  const response = await axios.post(
    `${baseUrl}/chat/completions`,
    {
      model,
      messages,
      temperature: provider.temperature ?? 0.2,
    },
    {
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      timeout: 60000,
    }
  );

  const text = response.data?.choices?.[0]?.message?.content?.trim() || "";
  if (!text) throw new Error("OpenAI-compatible provider returned no text.");
  return text;
}

function buildWandaPrompt(systemPrompt, history, userInput) {
  const lines = [];
  if (systemPrompt) {
    lines.push("System:");
    lines.push(systemPrompt);
    lines.push("");
  }
  if (history.length > 0) {
    lines.push("Conversation history:");
    for (const item of history) {
      lines.push(`${item.role === "assistant" ? "Assistant" : "User"}: ${item.content}`);
    }
    lines.push("");
  }
  lines.push(`Current user message: ${userInput}`);
  lines.push("Answer as assistant only.");
  return lines.join("\n");
}

async function wandaCliAdapter({ model, systemPrompt, history, userInput }) {
  const prompt = buildWandaPrompt(systemPrompt, history, userInput);
  const result = await wandaTestModel(prompt, { modelRef: model });
  return result.answer;
}

const runtime = new ChannelRuntime({
  providers: providerConfig.providers,
  defaultProvider: providerConfig.defaultProvider,
  maxHistory: providerConfig.maxHistory,
  systemPrompt: systemInstruction,
  adapters: {
    gemini: geminiAdapter,
    openai: openAIAdapter,
    "wanda-cli": wandaCliAdapter,
  },
});

function channelKeyFromContext(ctx) {
  const thread = ctx.message?.message_thread_id || "main";
  return `tg:${ctx.chat.id}:${thread}`;
}

function parseArgs(text) {
  return text.split(/\s+/).slice(1).filter(Boolean);
}

function statusText(status) {
  return [
    "Status",
    `Provider: ${status.provider}`,
    `Model: ${status.model}`,
    `History Turns: ${status.historyTurns}/${status.maxHistory * 2}`,
  ].join("\n");
}

function tailLines(value, limit = 14) {
  const lines = String(value || "")
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);
  return lines.slice(Math.max(0, lines.length - limit)).join("\n");
}

function oauthStatusText(status) {
  const lines = ["OAuth Status"];
  if (!status.tokens.length) {
    lines.push("Tokens: keine");
  } else {
    lines.push("Tokens:");
    for (const token of status.tokens) {
      lines.push(`- [${token.status}] ${token.label} bis ${token.expiresAtText}`);
    }
  }
  if (!status.keys.length) {
    lines.push("Keys: keine");
  } else {
    lines.push(`Keys: ${status.keys.join(", ")}`);
  }
  return lines.join("\n");
}

function buildProviderKeyboard() {
  const keyboard = new InlineKeyboard();
  const providers = runtime.listProviders();
  providers.forEach((name, index) => {
    keyboard.text(name, `set_provider:${name}`);
    if (index % 2 === 1) keyboard.row();
  });
  return keyboard.row().text("Models", "show_models").text("Reset", "reset_chat");
}

function buildModelKeyboard(channelKey) {
  const session = runtime.getSession(channelKey);
  const models = runtime.listModels(session.providerName);
  const keyboard = new InlineKeyboard();
  models.forEach((modelName, index) => {
    keyboard.text(modelName, `set_model:${modelName}`);
    if (index % 2 === 0) keyboard.row();
  });
  return keyboard.row().text("Providers", "show_providers");
}

async function withThinking(ctx, fn) {
  await ctx.replyWithChatAction("typing");
  return fn();
}

async function handleProviderCommand(ctx) {
  const key = channelKeyFromContext(ctx);
  const args = parseArgs(ctx.message.text);
  if (args.length === 0) {
    const providers = runtime.listProviders().join(", ");
    return ctx.reply(`Verfuegbare Provider: ${providers}\nNutze /provider <name>`);
  }
  const selected = runtime.setProvider(key, args[0]);
  debug("telegram", "set-provider", { key, provider: selected.provider, model: selected.model });
  return ctx.reply(`Provider gesetzt: ${selected.provider}\nModel: ${selected.model}`);
}

async function handleModelCommand(ctx) {
  const key = channelKeyFromContext(ctx);
  const args = parseArgs(ctx.message.text);
  if (args.length === 0) {
    const session = runtime.getSession(key);
    const models = runtime.listModels(session.providerName).join(", ");
    return ctx.reply(`Modelle fuer ${session.providerName}: ${models}\nNutze /model <name>`);
  }
  const selected = runtime.setModel(key, args[0]);
  debug("telegram", "set-model", { key, provider: selected.provider, model: selected.model });
  return ctx.reply(`Model gesetzt: ${selected.model} (Provider ${selected.provider})`);
}

async function forwardVoiceToWebhook(ctx, voice, fileUrl) {
  const webhook = process.env.VOX_STT_WEBHOOK_URL;
  if (!webhook) return false;

  await axios.post(
    webhook,
    {
      platform: "telegram",
      chatId: String(ctx.chat.id),
      userId: String(ctx.from.id),
      fileId: voice.file_id,
      duration: voice.duration,
      mimeType: voice.mime_type || "",
      fileUrl,
    },
    { timeout: 30000 }
  );
  return true;
}

async function handleVoiceMessage(ctx) {
  const voice = ctx.message.voice;
  const file = await ctx.api.getFile(voice.file_id);
  const fileUrl = `https://api.telegram.org/file/bot${TELEGRAM_TOKEN}/${file.file_path}`;
  const voxMode = String(process.env.VOX_STT_MODE || "webhook").trim().toLowerCase();

  if (voxMode === "cli") {
    if (!hasVoxCli(process.env.VOX_CLI_BIN)) {
      return ctx.reply("VOX CLI nicht gefunden. Setze VOX_CLI_BIN oder nutze VOX_STT_MODE=webhook.");
    }

    const extension = path.extname(file.file_path || "") || ".ogg";
    const tempFile = path.join(
      os.tmpdir(),
      `wanda_tg_voice_${ctx.chat.id}_${ctx.from.id}_${Date.now()}${extension}`
    );

    try {
      const fileResponse = await axios.get(fileUrl, {
        responseType: "arraybuffer",
        timeout: 60000,
      });
      await fs.writeFile(tempFile, Buffer.from(fileResponse.data));

      const transcription = await transcribeAudioFile(tempFile, {
        model: process.env.VOX_TRANSCRIBE_MODEL,
      });
      const transcript = transcription.transcript.trim();
      if (!transcript) {
        return ctx.reply("VOX hat keine nutzbare Transkription geliefert.");
      }

      const key = channelKeyFromContext(ctx);
      debug("telegram", "voice-transcribed", {
        key,
        transcriptLength: transcript.length,
      });
      const answer = await runtime.ask(key, transcript, {
        chatId: String(ctx.chat.id),
        userId: String(ctx.from.id),
        source: "telegram_voice",
      });

      return ctx.reply(`🎙 ${transcript}\n\n${answer}`);
    } catch (error) {
      debug("telegram", "voice-cli-error", { error: error.message });
      const forwarded = await forwardVoiceToWebhook(ctx, voice, fileUrl);
      if (forwarded) {
        return ctx.reply(
          `VOX-CLI Fehler (${error.message}). Voice wurde an den Webhook-Fallback weitergeleitet.`
        );
      }
      throw error;
    } finally {
      await fs.unlink(tempFile).catch(() => {});
    }
  }

  const forwarded = await forwardVoiceToWebhook(ctx, voice, fileUrl);
  if (!forwarded) {
    return ctx.reply(
      "Voice empfangen. Setze VOX_STT_MODE=cli mit VOX_CLI_BIN oder VOX_STT_WEBHOOK_URL fuer STT."
    );
  }

  return ctx.reply("Voice empfangen und an die STT-Pipeline uebergeben.");
}

function shouldAnswerText(ctx) {
  if (ctx.chat.type === "private") return true;
  const text = ctx.message.text || "";
  const username = ctx.me?.username ? `@${ctx.me.username}` : "";
  const isReplyToBot = ctx.message.reply_to_message?.from?.id === ctx.me?.id;
  const isMention = username && text.includes(username);
  return Boolean(isReplyToBot || isMention);
}

bot.command("start", (ctx) => {
  ctx.reply(
    "WANDA Telegram Bot online. Nutze /controls, /provider, /model, /status, /reset, /oauth_status, /oauth_login, /oauth_logout, /vox_status."
  );
});

bot.command("controls", (ctx) => {
  ctx.reply("Steuerung", { reply_markup: buildProviderKeyboard() });
});

bot.command("status", (ctx) => {
  const key = channelKeyFromContext(ctx);
  ctx.reply(statusText(runtime.status(key)));
});

bot.command("reset", (ctx) => {
  const key = channelKeyFromContext(ctx);
  runtime.reset(key);
  ctx.reply("Kontext wurde zurueckgesetzt.");
});

bot.command("provider", async (ctx) => {
  try {
    await handleProviderCommand(ctx);
  } catch (error) {
    await ctx.reply(`Provider-Fehler: ${error.message}`);
  }
});

bot.command("model", async (ctx) => {
  try {
    await handleModelCommand(ctx);
  } catch (error) {
    await ctx.reply(`Model-Fehler: ${error.message}`);
  }
});

bot.command("oauth_status", async (ctx) => {
  try {
    await withThinking(ctx, async () => {
      const status = await wandaAuthStatus({ binPath: process.env.WANDA_CLI_BIN });
      await ctx.reply(oauthStatusText(status));
    });
  } catch (error) {
    await ctx.reply(`OAuth-Status Fehler: ${error.message}`);
  }
});

bot.command("oauth_login", async (ctx) => {
  const args = parseArgs(ctx.message.text);
  if (args.length === 0) {
    await ctx.reply("Nutze /oauth_login <gemini|openai|anthropic|github|kimi>");
    return;
  }

  const provider = args[0];
  await ctx.reply(
    `Starte OAuth-Login fuer ${provider}. Der Flow oeffnet lokal einen Browser auf diesem Host und kann bis zu 10 Minuten dauern.`
  );
  try {
    await withThinking(ctx, async () => {
      const output = await wandaAuthLogin(provider, { binPath: process.env.WANDA_CLI_BIN });
      await ctx.reply(`OAuth Login Ergebnis (${provider}):\n${tailLines(output)}`);
    });
  } catch (error) {
    await ctx.reply(`OAuth-Login Fehler: ${error.message}`);
  }
});

bot.command("oauth_logout", async (ctx) => {
  const args = parseArgs(ctx.message.text);
  if (args.length === 0) {
    await ctx.reply("Nutze /oauth_logout <gemini|openai|anthropic|github|kimi>");
    return;
  }

  const provider = args[0];
  try {
    await withThinking(ctx, async () => {
      const output = await wandaAuthLogout(provider, { binPath: process.env.WANDA_CLI_BIN });
      await ctx.reply(`OAuth Logout Ergebnis (${provider}):\n${tailLines(output)}`);
    });
  } catch (error) {
    await ctx.reply(`OAuth-Logout Fehler: ${error.message}`);
  }
});

bot.command("vox_status", async (ctx) => {
  const voxFound = hasVoxCli(process.env.VOX_CLI_BIN);
  const mode = String(process.env.VOX_STT_MODE || "webhook").trim().toLowerCase();
  const webhook = process.env.VOX_STT_WEBHOOK_URL || "(unset)";
  await ctx.reply(
    [
      "VOX Status",
      `VOX CLI: ${voxFound ? "found" : "missing"}`,
      `VOX_STT_MODE: ${mode}`,
      `VOX_STT_WEBHOOK_URL: ${webhook}`,
      `VOX_TRANSCRIBE_MODEL: ${process.env.VOX_TRANSCRIBE_MODEL || "(default)"}`,
    ].join("\n")
  );
});

bot.on("callback_query:data", async (ctx) => {
  const key = channelKeyFromContext(ctx);
  try {
    const data = ctx.callbackQuery.data || "";
    if (data.startsWith("set_provider:")) {
      runtime.setProvider(key, data.replace("set_provider:", ""));
      await ctx.editMessageText("Provider gewechselt.", { reply_markup: buildProviderKeyboard() });
    } else if (data.startsWith("set_model:")) {
      runtime.setModel(key, data.replace("set_model:", ""));
      await ctx.editMessageText("Model gewechselt.", { reply_markup: buildModelKeyboard(key) });
    } else if (data === "show_models") {
      await ctx.editMessageText("Modelauswahl", { reply_markup: buildModelKeyboard(key) });
    } else if (data === "show_providers") {
      await ctx.editMessageText("Providerauswahl", { reply_markup: buildProviderKeyboard() });
    } else if (data === "reset_chat") {
      runtime.reset(key);
      await ctx.editMessageText("Kontext zurueckgesetzt.", { reply_markup: buildProviderKeyboard() });
    }
    await ctx.answerCallbackQuery();
  } catch (error) {
    await ctx.answerCallbackQuery({ text: `Fehler: ${error.message}` });
  }
});

bot.on("message:voice", async (ctx) => {
  try {
    await handleVoiceMessage(ctx);
  } catch (error) {
    await ctx.reply(`Voice-Fehler: ${error.message}`);
  }
});

bot.on("message:photo", async (ctx) => {
  await ctx.reply("Bild empfangen. Rich-Media Hook aktiv, Vision-Pipeline kann angebunden werden.");
});

bot.on("message:document", async (ctx) => {
  await ctx.reply("Datei empfangen. Ich kann sie im naechsten Schritt an eine Analyse-Pipeline leiten.");
});

bot.on("message:text", async (ctx) => {
  const text = ctx.message.text || "";
  if (text.startsWith("/")) return;
  if (!shouldAnswerText(ctx)) return;

  const key = channelKeyFromContext(ctx);
  debug("telegram", "text-message", { key, textLength: text.length });
  try {
    await withThinking(ctx, async () => {
      const answer = await runtime.ask(key, text, {
        chatId: String(ctx.chat.id),
        userId: String(ctx.from.id),
      });
      await ctx.reply(answer);
    });
  } catch (error) {
    await ctx.reply(`Antwort-Fehler: ${error.message}`);
  }
});

bot.catch((error) => {
  const updateId = error.ctx?.update?.update_id;
  debug("telegram", "fatal-catch", { updateId, error: String(error.error?.message || error.error) });
  console.error(`[Telegram Error][${updateId}]`, error.error);
});

bot.start();
console.log("WANDA Telegram Bot online.");

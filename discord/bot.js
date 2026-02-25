require("dotenv").config();
const axios = require("axios");
const {
  Client,
  GatewayIntentBits,
  Partials,
  Events,
  SlashCommandBuilder,
  EmbedBuilder,
} = require("discord.js");
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
const { hasVoxCli } = require("../shared/vox-cli");

const DISCORD_TOKEN = process.env.DISCORD_BOT_TOKEN;
if (!DISCORD_TOKEN) {
  console.error("Missing DISCORD_BOT_TOKEN");
  process.exit(1);
}

const providerConfig = resolveProviderConfig(process.env);
const geminiClients = new Map();
debug("discord", "provider-config", {
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

function channelKey(channel, userId) {
  const threadPart = channel?.isThread?.() ? channel.id : "main";
  return `dc:${channel?.id || "dm"}:${threadPart}:${userId}`;
}

function statusText(status) {
  return [
    "Status",
    `Provider: ${status.provider}`,
    `Model: ${status.model}`,
    `History Turns: ${status.historyTurns}/${status.maxHistory * 2}`,
  ].join("\n");
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

function tailLines(value, limit = 14) {
  const lines = String(value || "")
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);
  return lines.slice(Math.max(0, lines.length - limit)).join("\n");
}

function buildCommands() {
  const providerChoices = runtime
    .listProviders()
    .slice(0, 25)
    .map((name) => ({ name, value: name }));

  const providerCmd = new SlashCommandBuilder()
    .setName("provider")
    .setDescription("Provider anzeigen oder wechseln")
    .addStringOption((option) => {
      option
        .setName("name")
        .setDescription("Provider Name")
        .setRequired(false);
      if (providerChoices.length > 0) option.addChoices(...providerChoices);
      return option;
    });

  return [
    new SlashCommandBuilder()
      .setName("ask")
      .setDescription("Frage an WANDA")
      .addStringOption((option) =>
        option.setName("question").setDescription("Deine Frage").setRequired(true)
      ),
    providerCmd,
    new SlashCommandBuilder()
      .setName("model")
      .setDescription("Model fuer den aktuellen Kontext setzen")
      .addStringOption((option) =>
        option.setName("name").setDescription("Model Name").setRequired(true)
      ),
    new SlashCommandBuilder().setName("status").setDescription("Aktueller Runtime-Status"),
    new SlashCommandBuilder().setName("reset").setDescription("Kontext zuruecksetzen"),
    new SlashCommandBuilder().setName("oauth_status").setDescription("OAuth Status von Wanda CLI"),
    new SlashCommandBuilder()
      .setName("oauth_login")
      .setDescription("OAuth Login ueber Wanda CLI starten")
      .addStringOption((option) =>
        option
          .setName("provider")
          .setDescription("OAuth Provider")
          .setRequired(true)
          .addChoices(
            { name: "gemini", value: "gemini" },
            { name: "openai", value: "openai" },
            { name: "anthropic", value: "anthropic" },
            { name: "github", value: "github" },
            { name: "kimi", value: "kimi" }
          )
      ),
    new SlashCommandBuilder()
      .setName("oauth_logout")
      .setDescription("OAuth Logout ueber Wanda CLI")
      .addStringOption((option) =>
        option
          .setName("provider")
          .setDescription("OAuth Provider")
          .setRequired(true)
          .addChoices(
            { name: "gemini", value: "gemini" },
            { name: "openai", value: "openai" },
            { name: "anthropic", value: "anthropic" },
            { name: "github", value: "github" },
            { name: "kimi", value: "kimi" }
          )
      ),
    new SlashCommandBuilder().setName("vox_status").setDescription("VOX Bridge Status"),
  ].map((cmd) => cmd.toJSON());
}

async function askWithRuntime(channel, userId, input, metadata = {}) {
  const key = channelKey(channel, userId);
  return runtime.ask(key, input, metadata);
}

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.GuildVoiceStates,
    GatewayIntentBits.GuildMessageReactions,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.DirectMessages,
  ],
  partials: [Partials.Channel, Partials.Message],
});

client.once(Events.ClientReady, async (readyClient) => {
  const commands = buildCommands();
  const guildId = process.env.DISCORD_GUILD_ID;

  if (guildId) {
    const guild = await readyClient.guilds.fetch(guildId).catch(() => null);
    if (guild) {
      await guild.commands.set(commands);
      debug("discord", "commands-synced-guild", { guildId, count: commands.length });
      console.log(`Discord Bot online. Commands synced to guild ${guildId}.`);
      return;
    }
  }

  await readyClient.application.commands.set(commands);
  debug("discord", "commands-synced-global", { count: commands.length });
  console.log("Discord Bot online. Commands synced globally.");
});

client.on(Events.InteractionCreate, async (interaction) => {
  if (!interaction.isChatInputCommand()) return;

  const key = channelKey(interaction.channel, interaction.user.id);

  try {
    debug("discord", "interaction", {
      command: interaction.commandName,
      userId: interaction.user.id,
      channelId: interaction.channelId,
    });
    if (interaction.commandName === "ask") {
      const question = interaction.options.getString("question", true);
      await interaction.deferReply();
      const answer = await askWithRuntime(interaction.channel, interaction.user.id, question, {
        platform: "discord",
        channelId: interaction.channelId,
        userId: interaction.user.id,
      });

      const embed = new EmbedBuilder().setTitle("WANDA").setDescription(answer.slice(0, 4096));
      await interaction.editReply({ embeds: [embed] });
      const replyMessage = await interaction.fetchReply();
      await replyMessage.react("✅").catch(() => {});
      return;
    }

    if (interaction.commandName === "provider") {
      const selected = interaction.options.getString("name");
      if (!selected) {
        const status = runtime.status(key);
        const providers = runtime.listProviders().join(", ");
        await interaction.reply(
          `Aktueller Provider: ${status.provider}\nModel: ${status.model}\nVerfuegbar: ${providers}`
        );
        return;
      }

      const result = runtime.setProvider(key, selected);
      await interaction.reply(`Provider gesetzt: ${result.provider}\nModel: ${result.model}`);
      return;
    }

    if (interaction.commandName === "model") {
      const model = interaction.options.getString("name", true);
      const result = runtime.setModel(key, model);
      await interaction.reply(`Model gesetzt: ${result.model} (Provider ${result.provider})`);
      return;
    }

    if (interaction.commandName === "status") {
      const status = runtime.status(key);
      const embed = new EmbedBuilder().setTitle("Runtime Status").setDescription(statusText(status));
      await interaction.reply({ embeds: [embed] });
      return;
    }

    if (interaction.commandName === "reset") {
      runtime.reset(key);
      await interaction.reply("Kontext wurde zurueckgesetzt.");
      return;
    }

    if (interaction.commandName === "oauth_status") {
      await interaction.deferReply();
      const status = await wandaAuthStatus({ binPath: process.env.WANDA_CLI_BIN });
      const embed = new EmbedBuilder().setTitle("OAuth").setDescription(oauthStatusText(status));
      await interaction.editReply({ embeds: [embed] });
      return;
    }

    if (interaction.commandName === "oauth_login") {
      const provider = interaction.options.getString("provider", true);
      await interaction.deferReply();
      const output = await wandaAuthLogin(provider, { binPath: process.env.WANDA_CLI_BIN });
      await interaction.editReply(`OAuth Login Ergebnis (${provider}):\n${tailLines(output)}`);
      return;
    }

    if (interaction.commandName === "oauth_logout") {
      const provider = interaction.options.getString("provider", true);
      await interaction.deferReply();
      const output = await wandaAuthLogout(provider, { binPath: process.env.WANDA_CLI_BIN });
      await interaction.editReply(`OAuth Logout Ergebnis (${provider}):\n${tailLines(output)}`);
      return;
    }

    if (interaction.commandName === "vox_status") {
      const voxFound = hasVoxCli(process.env.VOX_CLI_BIN);
      const mode = String(process.env.VOX_STT_MODE || "webhook").trim().toLowerCase();
      const webhook = process.env.VOX_STT_WEBHOOK_URL || "(unset)";
      await interaction.reply(
        [
          "VOX Status",
          `VOX CLI: ${voxFound ? "found" : "missing"}`,
          `VOX_STT_MODE: ${mode}`,
          `VOX_STT_WEBHOOK_URL: ${webhook}`,
          `VOX_TRANSCRIBE_MODEL: ${process.env.VOX_TRANSCRIBE_MODEL || "(default)"}`,
        ].join("\n")
      );
      return;
    }
  } catch (error) {
    debug("discord", "interaction-error", {
      command: interaction.commandName,
      error: error.message,
    });
    const message = `Discord Command Fehler: ${error.message}`;
    if (interaction.deferred || interaction.replied) {
      await interaction.editReply(message).catch(() => {});
    } else {
      await interaction.reply({ content: message, ephemeral: true }).catch(() => {});
    }
  }
});

client.on(Events.MessageCreate, async (message) => {
  if (message.author.bot) return;

  const botId = client.user?.id;
  const isMention = Boolean(botId && message.mentions.users.has(botId));
  const isReplyToBot = message.reference?.messageId
    ? await message.channel.messages
        .fetch(message.reference.messageId)
        .then((m) => m.author?.id === botId)
        .catch(() => false)
    : false;

  if (!isMention && !isReplyToBot) return;

  let text = message.content || "";
  if (botId) {
    const mentionRegex = new RegExp(`<@!?${botId}>`, "g");
    text = text.replace(mentionRegex, "").trim();
  }
  if (!text) return;

  try {
    debug("discord", "mention-message", {
      channelId: message.channelId,
      userId: message.author.id,
      textLength: text.length,
    });
    await message.react("⏳").catch(() => {});
    const answer = await askWithRuntime(message.channel, message.author.id, text, {
      platform: "discord",
      channelId: message.channelId,
      userId: message.author.id,
      source: "mention",
    });

    const embed = new EmbedBuilder().setTitle("WANDA").setDescription(answer.slice(0, 4096));
    await message.reply({ embeds: [embed] });
    await message.react("✅").catch(() => {});
  } catch (error) {
    debug("discord", "mention-error", { channelId: message.channelId, error: error.message });
    await message.reply(`Antwort-Fehler: ${error.message}`).catch(() => {});
  }
});

client.on(Events.VoiceStateUpdate, (oldState, newState) => {
  const user = newState.member?.user || oldState.member?.user;
  if (!user || user.bot) return;
  if (oldState.channelId === newState.channelId) return;
  debug("discord", "voice-state-update", {
    userId: user.id,
    from: oldState.channelId || null,
    to: newState.channelId || null,
  });

  if (newState.channelId && !oldState.channelId) {
    console.log(`Voice presence: ${user.tag} joined ${newState.channel?.name || newState.channelId}`);
  } else if (!newState.channelId && oldState.channelId) {
    console.log(`Voice presence: ${user.tag} left ${oldState.channel?.name || oldState.channelId}`);
  } else {
    console.log(
      `Voice presence: ${user.tag} moved ${oldState.channel?.name || oldState.channelId} -> ${newState.channel?.name || newState.channelId}`
    );
  }
});

client.login(DISCORD_TOKEN);

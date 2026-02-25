"use strict";

const { hasWandaCli } = require("./wanda-cli");

function toList(value) {
  if (!value || typeof value !== "string") return [];
  return value
    .split(",")
    .map((v) => v.trim())
    .filter(Boolean);
}

function pickFirst(...values) {
  for (const value of values) {
    if (value !== undefined && value !== null && String(value).trim() !== "") {
      return value;
    }
  }
  return undefined;
}

function normalizeProvider(name, raw, env) {
  const provider = {
    name,
    type: raw.type || name,
    models: Array.isArray(raw.models) ? raw.models.filter(Boolean) : [],
    defaultModel: raw.defaultModel || raw.model,
    temperature: typeof raw.temperature === "number" ? raw.temperature : 0.2,
    baseUrl: raw.baseUrl || raw.baseURL || "",
    apiKeyEnv: raw.apiKeyEnv || "",
    apiKey: raw.apiKey || "",
  };

  if (!provider.apiKey && provider.apiKeyEnv) {
    provider.apiKey = env[provider.apiKeyEnv] || "";
  }
  if (!provider.defaultModel && provider.models.length > 0) {
    provider.defaultModel = provider.models[0];
  }
  if (!provider.defaultModel) return null;
  if (!provider.models.includes(provider.defaultModel)) {
    provider.models.unshift(provider.defaultModel);
  }
  return provider;
}

function buildFromEnvironment(env) {
  const providers = {};

  if (env.GOOGLE_API_KEY) {
    const models = toList(pickFirst(env.GEMINI_MODELS, env.GEMINI_MODEL));
    providers.gemini = {
      type: "gemini",
      models: models.length > 0 ? models : ["gemini-2.5-flash", "gemini-2.5-pro"],
      defaultModel: pickFirst(env.GEMINI_DEFAULT_MODEL, models[0], "gemini-2.5-flash"),
      temperature: Number(pickFirst(env.GEMINI_TEMPERATURE, "0.2")),
      apiKeyEnv: "GOOGLE_API_KEY",
    };
  }

  if (env.OPENAI_API_KEY || env.OPENAI_BASE_URL || env.OPENAI_MODEL || env.OPENAI_MODELS) {
    const models = toList(pickFirst(env.OPENAI_MODELS, env.OPENAI_MODEL));
    providers.openai = {
      type: "openai",
      baseUrl: pickFirst(env.OPENAI_BASE_URL, "https://api.openai.com/v1"),
      models: models.length > 0 ? models : ["gpt-5-mini"],
      defaultModel: pickFirst(env.OPENAI_DEFAULT_MODEL, models[0], "gpt-5-mini"),
      temperature: Number(pickFirst(env.OPENAI_TEMPERATURE, "0.2")),
      apiKeyEnv: "OPENAI_API_KEY",
    };
  }

  if (env.OLLAMA_BASE_URL || env.OLLAMA_MODEL || env.OLLAMA_MODELS) {
    const models = toList(pickFirst(env.OLLAMA_MODELS, env.OLLAMA_MODEL));
    providers.ollama = {
      type: "openai",
      baseUrl: pickFirst(env.OLLAMA_BASE_URL, "http://localhost:11434/v1"),
      models: models.length > 0 ? models : ["qwen2.5:7b-instruct"],
      defaultModel: pickFirst(env.OLLAMA_DEFAULT_MODEL, models[0], "qwen2.5:7b-instruct"),
      temperature: Number(pickFirst(env.OLLAMA_TEMPERATURE, "0.2")),
      apiKey: pickFirst(env.OLLAMA_API_KEY, "ollama"),
    };
  }

  const wandaCliEnabled = !["0", "false", "no", "off"].includes(
    String(pickFirst(env.WANDA_CLI_ENABLED, "true")).trim().toLowerCase()
  );
  if (wandaCliEnabled && hasWandaCli(env.WANDA_CLI_BIN)) {
    const modelRefs = toList(pickFirst(env.WANDA_CLI_MODEL_REFS, env.WANDA_CLI_MODEL_REF));
    providers.wanda = {
      type: "wanda-cli",
      models:
        modelRefs.length > 0
          ? modelRefs
          : [
              "gemini/oauth/gemini-3.1-pro-high",
              "openai/oauth/gpt-5.2",
              "anthropic/oauth/claude-4.6-sonnet",
            ],
      defaultModel: pickFirst(
        env.WANDA_CLI_DEFAULT_MODEL,
        modelRefs[0],
        "gemini/oauth/gemini-3.1-pro-high"
      ),
      temperature: Number(pickFirst(env.WANDA_CLI_TEMPERATURE, "0.2")),
    };
  }

  return providers;
}

function resolveProviderConfig(env) {
  let rawProviders = null;
  if (env.WANDA_PROVIDERS_JSON) {
    try {
      rawProviders = JSON.parse(env.WANDA_PROVIDERS_JSON);
    } catch (error) {
      throw new Error(`WANDA_PROVIDERS_JSON is invalid JSON: ${error.message}`);
    }
  } else {
    rawProviders = buildFromEnvironment(env);
  }

  const providers = {};
  for (const [name, raw] of Object.entries(rawProviders || {})) {
    const normalized = normalizeProvider(name, raw || {}, env);
    if (normalized) providers[name] = normalized;
  }

  const providerNames = Object.keys(providers);
  if (providerNames.length === 0) {
    throw new Error(
      "No providers configured. Set GOOGLE_API_KEY or OPENAI/OLLAMA env vars, or WANDA_PROVIDERS_JSON."
    );
  }

  const defaultProvider =
    env.WANDA_DEFAULT_PROVIDER && providers[env.WANDA_DEFAULT_PROVIDER]
      ? env.WANDA_DEFAULT_PROVIDER
      : providerNames[0];

  const maxHistory = Number.isFinite(Number(env.WANDA_MAX_HISTORY))
    ? Math.max(2, Number(env.WANDA_MAX_HISTORY))
    : 14;

  return { providers, defaultProvider, maxHistory };
}

module.exports = {
  resolveProviderConfig,
};

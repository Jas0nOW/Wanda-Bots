"use strict";

class ChannelRuntime {
  constructor({ providers, defaultProvider, systemPrompt, adapters, maxHistory = 14 }) {
    this.providers = providers;
    this.defaultProvider = defaultProvider;
    this.systemPrompt = systemPrompt || "";
    this.adapters = adapters || {};
    this.maxHistory = maxHistory;
    this.sessions = new Map();
  }

  listProviders() {
    return Object.keys(this.providers);
  }

  _newSession() {
    const providerName = this.defaultProvider;
    const provider = this.providers[providerName];
    return {
      providerName,
      model: provider.defaultModel,
      history: [],
    };
  }

  getSession(channelKey) {
    if (!this.sessions.has(channelKey)) {
      this.sessions.set(channelKey, this._newSession());
    }
    return this.sessions.get(channelKey);
  }

  listModels(providerName) {
    const provider = this.providers[providerName];
    return provider ? provider.models : [];
  }

  setProvider(channelKey, providerName) {
    const provider = this.providers[providerName];
    if (!provider) {
      throw new Error(`Unknown provider: ${providerName}`);
    }
    const session = this.getSession(channelKey);
    session.providerName = providerName;
    session.model = provider.defaultModel;
    session.history = [];
    return { provider: providerName, model: session.model };
  }

  setModel(channelKey, model) {
    const session = this.getSession(channelKey);
    const provider = this.providers[session.providerName];
    if (!provider.models.includes(model)) {
      throw new Error(`Model '${model}' is not configured for provider '${session.providerName}'.`);
    }
    session.model = model;
    return { provider: session.providerName, model: session.model };
  }

  reset(channelKey) {
    this.sessions.set(channelKey, this._newSession());
    return this.getSession(channelKey);
  }

  status(channelKey) {
    const session = this.getSession(channelKey);
    return {
      provider: session.providerName,
      model: session.model,
      historyTurns: session.history.length,
      maxHistory: this.maxHistory,
    };
  }

  _prune(history) {
    const maxItems = this.maxHistory * 2;
    if (history.length > maxItems) {
      return history.slice(history.length - maxItems);
    }
    return history;
  }

  async ask(channelKey, userInput, metadata = {}) {
    const session = this.getSession(channelKey);
    const provider = this.providers[session.providerName];
    const adapter = this.adapters[provider.type];

    if (!adapter) {
      throw new Error(`No adapter for provider type: ${provider.type}`);
    }

    const answer = await adapter({
      provider,
      model: session.model,
      systemPrompt: this.systemPrompt,
      history: session.history,
      userInput,
      metadata,
    });

    session.history.push({ role: "user", content: userInput });
    session.history.push({ role: "assistant", content: answer });
    session.history = this._prune(session.history);
    return answer;
  }
}

module.exports = {
  ChannelRuntime,
};

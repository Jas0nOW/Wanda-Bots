"use strict";

function isEnabled() {
  const value = String(process.env.WANDA_DEBUG || "").trim().toLowerCase();
  return ["1", "true", "yes", "on", "debug"].includes(value);
}

function formatMeta(meta) {
  if (!meta) return "";
  try {
    return ` ${JSON.stringify(meta)}`;
  } catch {
    return " [meta-unserializable]";
  }
}

function debug(scope, message, meta) {
  if (!isEnabled()) return;
  const prefix = `[WANDA_DEBUG][${scope}]`;
  const text = `${prefix} ${message}${formatMeta(meta)}`;
  process.stderr.write(`${text}\n`);
}

module.exports = {
  isEnabled,
  debug,
};

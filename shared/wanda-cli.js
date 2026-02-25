"use strict";

const fs = require("node:fs");
const { spawn } = require("node:child_process");
const { debug } = require("./debug");

const DEFAULT_WANDA_CLI_BIN =
  process.env.WANDA_CLI_BIN || "/home/jannis/Schreibtisch/Work-OS/40_Products/-Wanda-/wanda";

function hasWandaCli(binPath = DEFAULT_WANDA_CLI_BIN) {
  return fs.existsSync(binPath);
}

function runWandaCli(args, { timeoutMs = 180000, binPath = DEFAULT_WANDA_CLI_BIN } = {}) {
  return new Promise((resolve, reject) => {
    if (!hasWandaCli(binPath)) {
      reject(new Error(`Wanda CLI not found at ${binPath}`));
      return;
    }

    const child = spawn(binPath, args, {
      stdio: ["ignore", "pipe", "pipe"],
      env: process.env,
    });
    debug("wanda-cli", "spawn", { binPath, args, timeoutMs });

    let stdout = "";
    let stderr = "";
    let timedOut = false;

    const timer = setTimeout(() => {
      timedOut = true;
      child.kill("SIGTERM");
    }, timeoutMs);

    child.stdout.on("data", (chunk) => {
      stdout += String(chunk);
    });

    child.stderr.on("data", (chunk) => {
      stderr += String(chunk);
    });

    child.on("error", (error) => {
      clearTimeout(timer);
      reject(error);
    });

    child.on("exit", (code) => {
      clearTimeout(timer);
      debug("wanda-cli", "exit", { code, timedOut });
      if (timedOut) {
        reject(new Error(`Wanda CLI timed out after ${timeoutMs}ms.`));
        return;
      }
      if (code !== 0) {
        reject(new Error((stderr || stdout || `Wanda CLI exited with code ${code}`).trim()));
        return;
      }
      resolve({ stdout, stderr, code });
    });
  });
}

function parseAuthStatus(output) {
  const lines = String(output || "")
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);

  const tokens = [];
  const keys = [];

  for (const line of lines) {
    const tokenMatch = line.match(/^\[(OK|EXP)\]\s+(.+?)\s+--\s+bis\s+(.+)$/i);
    if (tokenMatch) {
      tokens.push({
        status: tokenMatch[1].toUpperCase(),
        label: tokenMatch[2].trim(),
        expiresAtText: tokenMatch[3].trim(),
      });
      continue;
    }

    const keyMatch = line.match(/^\[KEY\]\s+(.+)$/i);
    if (keyMatch) {
      keys.push(keyMatch[1].trim());
    }
  }

  return {
    tokens,
    keys,
    raw: String(output || "").trim(),
  };
}

function parseTestModelOutput(output) {
  const raw = String(output || "");
  const lines = raw.split(/\r?\n/);
  const start = lines.findIndex((line) => line.includes("Antwort:"));

  if (start >= 0) {
    const answerLines = [];
    for (let i = start + 1; i < lines.length; i += 1) {
      const line = lines[i];
      if (line.trim() === "") {
        if (answerLines.length > 0) break;
        continue;
      }
      answerLines.push(line.replace(/^\s+/, ""));
    }

    const answer = answerLines.join("\n").trim();
    if (answer) return answer;
  }

  const fallback = lines.map((line) => line.trim()).filter(Boolean).pop() || "";
  return fallback;
}

async function authStatus(options = {}) {
  const result = await runWandaCli(["auth", "status"], options);
  return parseAuthStatus(result.stdout);
}

async function authLogin(provider, options = {}) {
  const normalizedProvider = String(provider || "").trim().toLowerCase();
  if (!normalizedProvider) throw new Error("Missing provider for OAuth login.");
  const result = await runWandaCli(["auth", "login", normalizedProvider], {
    timeoutMs: 600000,
    ...options,
  });
  return String(result.stdout || "").trim();
}

async function authLogout(provider, options = {}) {
  const normalizedProvider = String(provider || "").trim().toLowerCase();
  if (!normalizedProvider) throw new Error("Missing provider for OAuth logout.");
  const result = await runWandaCli(["auth", "logout", normalizedProvider], options);
  return String(result.stdout || "").trim();
}

async function testModel(prompt, { modelRef, timeoutMs = 180000, binPath } = {}) {
  const text = String(prompt || "").trim();
  if (!text) throw new Error("Prompt is required for wanda test model.");

  if (modelRef && String(modelRef).trim() !== "") {
    await runWandaCli(["model", "select", String(modelRef).trim()], {
      timeoutMs: 60000,
      binPath,
    });
  }

  const result = await runWandaCli(["test", "model", text], {
    timeoutMs,
    binPath,
  });

  const answer = parseTestModelOutput(result.stdout);
  if (!answer) throw new Error("Wanda CLI returned no answer text.");
  return {
    answer,
    raw: String(result.stdout || "").trim(),
  };
}

module.exports = {
  DEFAULT_WANDA_CLI_BIN,
  hasWandaCli,
  runWandaCli,
  authStatus,
  authLogin,
  authLogout,
  testModel,
};

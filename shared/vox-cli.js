"use strict";

const fs = require("node:fs");
const path = require("node:path");
const { spawn } = require("node:child_process");
const { debug } = require("./debug");

const DEFAULT_VOX_CLI_BIN =
  process.env.VOX_CLI_BIN ||
  "/home/jannis/Schreibtisch/Work-OS/40_Products/Vox-Voice/.venv/bin/python3";
const DEFAULT_VOX_PROJECT_ROOT =
  process.env.VOX_PROJECT_ROOT || "/home/jannis/Schreibtisch/Work-OS/40_Products/Vox-Voice";
const DEFAULT_VOX_SRC_ROOT = `${DEFAULT_VOX_PROJECT_ROOT}/src`;

function hasVoxCli(binPath = DEFAULT_VOX_CLI_BIN) {
  if (binPath === "vox") return true;
  return fs.existsSync(binPath);
}

function enrichVoxError(message) {
  const text = String(message || "").trim();
  if (/No module named 'websockets'/.test(text)) {
    return `${text}\nHint: install VOX deps, e.g. 'cd ${DEFAULT_VOX_PROJECT_ROOT} && .venv/bin/pip install -r requirements.txt'.`;
  }
  return text;
}

function runVoxCli(args, { timeoutMs = 180000, binPath = DEFAULT_VOX_CLI_BIN } = {}) {
  return new Promise((resolve, reject) => {
    if (!hasVoxCli(binPath)) {
      reject(new Error(`VOX CLI not found at ${binPath}`));
      return;
    }

    const runWithPythonModule =
      path.basename(binPath).startsWith("python") && binPath !== "vox";
    const commandArgs = runWithPythonModule ? ["-m", "wandavoice.main", ...args] : args;

    const mergedPath = process.env.PYTHONPATH
      ? `${DEFAULT_VOX_SRC_ROOT}:${process.env.PYTHONPATH}`
      : DEFAULT_VOX_SRC_ROOT;

    const child = spawn(binPath, commandArgs, {
      stdio: ["ignore", "pipe", "pipe"],
      env: {
        ...process.env,
        PYTHONPATH: mergedPath,
      },
      cwd: DEFAULT_VOX_PROJECT_ROOT,
    });
    debug("vox-cli", "spawn", { binPath, commandArgs, timeoutMs, cwd: DEFAULT_VOX_PROJECT_ROOT });

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
      debug("vox-cli", "exit", { code, timedOut });
      if (timedOut) {
        reject(new Error(`VOX CLI timed out after ${timeoutMs}ms.`));
        return;
      }
      if (code !== 0) {
        reject(new Error(enrichVoxError(stderr || stdout || `VOX CLI exited with code ${code}`)));
        return;
      }
      resolve({ stdout, stderr, code });
    });
  });
}

function stripAnsi(text) {
  return String(text || "").replace(/\x1b\[[0-9;]*m/g, "");
}

function parseTranscription(output) {
  const clean = stripAnsi(output);
  const lines = clean.split(/\r?\n/).map((line) => line.trim());
  const userLine = lines.find((line) => line.startsWith("USER >"));
  if (userLine) return userLine.replace(/^USER\s*>\s*/, "").trim();
  return "";
}

async function transcribeAudioFile(filePath, { model, timeoutMs = 600000, binPath } = {}) {
  const args = ["transcribe", filePath];
  if (model) {
    args.push("--model", String(model));
  }

  const result = await runVoxCli(args, { timeoutMs, binPath });
  const transcript = parseTranscription(result.stdout);
  if (!transcript) {
    throw new Error("VOX transcription returned no text.");
  }

  return {
    transcript,
    raw: stripAnsi(result.stdout).trim(),
  };
}

async function healthCheck(options = {}) {
  const result = await runVoxCli(["--help"], { timeoutMs: 20000, ...options });
  return /VOX Voice|Usage:/i.test(stripAnsi(result.stdout));
}

module.exports = {
  DEFAULT_VOX_CLI_BIN,
  hasVoxCli,
  runVoxCli,
  transcribeAudioFile,
  healthCheck,
};

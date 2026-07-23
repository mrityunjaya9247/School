// Single source of truth for LLM connection settings. config/llm.config.json
// holds non-secret defaults; env vars (see .env.example) override at startup.
// Switching models later = edit llm.config.json or .env, never this code.
'use strict';

const fs = require('fs');
const path = require('path');
require('dotenv').config();

const CONFIG_PATH = path.join(__dirname, '..', 'config', 'llm.config.json');

function loadJsonConfig() {
  try {
    const raw = fs.readFileSync(CONFIG_PATH, 'utf8');
    return JSON.parse(raw);
  } catch (err) {
    console.warn(`[config] Could not read ${CONFIG_PATH} (${err.message}) — using built-in defaults.`);
    return {
      enabled: true,
      baseUrl: 'http://localhost:11434/v1',
      model: 'qwen3:4b',
      timeoutMs: 12000,
      params: { temperature: 0.3, top_p: 0.9, max_tokens: 400 },
      qwen3: { disableThinking: true },
      promptFile: 'prompts/rewrite.prompt.txt',
    };
  }
}

function loadPrompt(promptFile) {
  const promptPath = path.join(__dirname, '..', promptFile);
  try {
    return fs.readFileSync(promptPath, 'utf8').trim();
  } catch (err) {
    console.warn(`[config] Prompt file missing at ${promptPath} (${err.message}) — AI rewrite will use a bare fallback prompt.`);
    return 'You are a writing assistant for a school. Rewrite the note into a clear, polite parent message. Do not invent facts. Output only the final message.';
  }
}

const json = loadJsonConfig();

const enabled = process.env.AI_REWRITE_ENABLED != null
  ? process.env.AI_REWRITE_ENABLED === 'true'
  : json.enabled;

const config = {
  enabled,
  baseUrl: process.env.LLM_BASE_URL || json.baseUrl,
  model: process.env.LLM_MODEL || json.model,
  apiKey: process.env.LLM_API_KEY || null,
  timeoutMs: json.timeoutMs,
  params: json.params,
  qwen3: json.qwen3 || {},
  port: Number(process.env.PORT) || 8787,
  allowedOrigins: (process.env.ALLOWED_ORIGINS || 'http://localhost:8000')
    .split(',').map(s => s.trim()).filter(Boolean),
  prompt: loadPrompt(json.promptFile),
};

module.exports = config;

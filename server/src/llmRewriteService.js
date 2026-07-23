// Talks to a locally hosted OpenAI-compatible LLM (Ollama by default) to turn
// a teacher's short note into a polished parent message. Never sends the
// message anywhere itself — the controller/frontend own that.
'use strict';

const config = require('./config');

class LLMError extends Error {
  constructor(message, code) {
    super(message);
    this.name = 'LLMError';
    this.code = code; // 'timeout' | 'upstream_error' | 'network_error'
  }
}

function stripThink(text) {
  return text.replace(/<think>[\s\S]*?<\/think>/gi, '').trim();
}

function buildUserMessage(text, language, tone, maxChars) {
  let msg = `Note: ${text}\nLanguage: ${language}\nTone: ${tone}`;
  if (maxChars) msg += `\nMax length: ${maxChars} characters`;
  if (config.qwen3.disableThinking) msg += ' /no_think';
  return msg;
}

// rewriteMessage(text, { language, tone, maxChars }) -> Promise<string>
async function rewriteMessage(text, { language = 'English', tone = 'friendly', maxChars } = {}) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), config.timeoutMs);
  const startedAt = Date.now();

  const headers = { 'Content-Type': 'application/json' };
  if (config.apiKey) headers.Authorization = `Bearer ${config.apiKey}`;

  const body = {
    model: config.model,
    messages: [
      { role: 'system', content: config.prompt },
      { role: 'user', content: buildUserMessage(text, language, tone, maxChars) },
    ],
    ...config.params,
  };

  let res;
  try {
    res = await fetch(`${config.baseUrl}/chat/completions`, {
      method: 'POST',
      headers,
      body: JSON.stringify(body),
      signal: controller.signal,
    });
  } catch (err) {
    clearTimeout(timer);
    const latencyMs = Date.now() - startedAt;
    if (err.name === 'AbortError') {
      console.warn(`[llmRewrite] timeout after ${latencyMs}ms (limit ${config.timeoutMs}ms)`);
      throw new LLMError('LLM request timed out', 'timeout');
    }
    console.warn(`[llmRewrite] network error after ${latencyMs}ms: ${err.message}`);
    throw new LLMError('LLM request failed', 'network_error');
  }
  clearTimeout(timer);
  const latencyMs = Date.now() - startedAt;

  if (!res.ok) {
    console.warn(`[llmRewrite] upstream ${res.status} after ${latencyMs}ms`);
    throw new LLMError(`LLM upstream returned ${res.status}`, 'upstream_error');
  }

  const data = await res.json();
  const raw = data?.choices?.[0]?.message?.content || '';
  const message = stripThink(raw);

  // Metadata only — never log the note or the drafted message, both may
  // contain student names or other PII.
  console.log(`[llmRewrite] ok status=${res.status} latencyMs=${latencyMs} outLen=${message.length}`);
  if (process.env.DEBUG_LLM === 'true') {
    console.debug('[llmRewrite:debug] full response body:', JSON.stringify(data));
  }

  if (!message) throw new LLMError('LLM returned an empty response', 'upstream_error');
  return message;
}

module.exports = { rewriteMessage, LLMError };

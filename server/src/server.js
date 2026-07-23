'use strict';

const express = require('express');
const cors = require('cors');
const config = require('./config');
const { requireStaff } = require('./staffAuth');
const { createRateLimiter } = require('./rateLimiter');
const { rewriteMessage, LLMError } = require('./llmRewriteService');

const app = express();
app.use(cors({ origin: config.allowedOrigins }));
app.use(express.json({ limit: '10kb' }));

const allowRewrite = createRateLimiter({ limit: 20, windowMs: 60_000 });

const MAX_TEXT_LENGTH = 1000;

app.post('/api/ai/rewrite', requireStaff, async (req, res) => {
  if (!config.enabled) {
    return res.status(404).json({ error: 'AI rewrite is disabled' });
  }

  const { text, language = 'English', tone = 'friendly', maxChars } = req.body || {};
  if (typeof text !== 'string' || !text.trim()) {
    return res.status(400).json({ error: 'text is required' });
  }
  if (text.length > MAX_TEXT_LENGTH) {
    return res.status(400).json({ error: `text must be under ${MAX_TEXT_LENGTH} characters` });
  }

  if (!allowRewrite(req.staff.staffId)) {
    return res.status(429).json({ error: 'Too many requests — please slow down.' });
  }

  try {
    const message = await rewriteMessage(text.trim(), { language, tone, maxChars });
    return res.status(200).json({ message });
  } catch (err) {
    if (err instanceof LLMError) {
      console.warn(`[api] rewrite soft-failed for staff=${req.staff.staffId} code=${err.code}`);
      return res.status(503).json({ error: 'AI temporarily unavailable' });
    }
    console.error('[api] unexpected error in /api/ai/rewrite:', err);
    return res.status(503).json({ error: 'AI temporarily unavailable' });
  }
});

app.get('/health', (req, res) => res.json({ ok: true, aiRewriteEnabled: config.enabled }));

app.listen(config.port, () => {
  console.log(`[server] AI rewrite proxy listening on :${config.port} (enabled=${config.enabled}, model=${config.model})`);
});

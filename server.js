require('dotenv').config();
const express = require('express');
const cors = require('cors');
const { GoogleGenerativeAI } = require('@google/generative-ai');

const app = express();
const PORT = process.env.PORT || 3000;

if (!process.env.GEMINI_API_KEY) {
  console.error('Missing GEMINI_API_KEY. Copy .env.example to .env and add your key.');
  process.exit(1);
}

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

// ---- Customize your assistant here ----
const SYSTEM_PROMPT = `You are the assistant for "AI MACHA," a personal blog about one person's
journey learning AI, written by Roshhh. The blog documents real, honest learning moments —
what clicked, what broke, and what's currently being explored (right now: how embeddings work).

You can help visitors with two things:
1. Questions about the AI MACHA blog itself — its posts, its purpose, or what Roshhh has been
   learning and writing about.
2. General questions about AI — concepts, tools, how things work — explained clearly and simply,
   the way you'd explain it to someone also learning.

If asked who made this blog or this assistant, mention that Roshhh built it as part of learning
AI hands-on. Be warm, encouraging, and honest — if you don't know something, say so rather than
guessing. Keep answers concise and easy to follow.`;

const TEXT_MODEL = process.env.GEMINI_MODEL || 'gemini-3.5-flash-lite';

app.use(cors());
app.use(express.json({ limit: '1mb' }));
app.use(express.static('public'));

const requestLog = new Map();
const RATE_LIMIT = 20;
const RATE_WINDOW_MS = 60 * 1000;

function isRateLimited(ip) {
  const now = Date.now();
  const entry = requestLog.get(ip) || [];
  const recent = entry.filter((t) => now - t < RATE_WINDOW_MS);
  recent.push(now);
  requestLog.set(ip, recent);
  return recent.length > RATE_LIMIT;
}

// Catches explicit ("draw a robot") and implicit ("show me what X looks like") image requests.
const IMAGE_INTENT_PATTERNS = [
  /\bdraw\b/i, /\bsketch\b/i, /\bpaint\b/i, /\billustrat/i,
  /\bgenerate (an? |the )?image/i, /\bcreate (an? |the )?image/i,
  /\bmake (an? |the )?(image|picture|graphic)/i,
  /\bshow me (what|a|an)\b.*\blooks?\b/i,
  /\bpicture of\b/i, /\bimage of\b/i, /\bvisualiz/i,
  /\bdiagram of\b/i, /\bicon of\b/i, /\bavatar\b/i, /\blogo for\b/i,
];

function looksLikeImageRequest(text) {
  return IMAGE_INTENT_PATTERNS.some((re) => re.test(text));
}

// Free image generation via Pollinations.ai (no key). Anonymous use is rate limited
// (about 1 request per 15 seconds), so we keep the request small and handle failures.
async function generateImage(prompt) {
  const url =
    'https://image.pollinations.ai/prompt/' +
    encodeURIComponent(prompt.slice(0, 500)) +
    '?width=512&height=512&nologo=true';

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 60000);
  try {
    const resp = await fetch(url, { signal: controller.signal });
    if (!resp.ok) throw new Error('Image service returned status ' + resp.status);
    const mimeType = resp.headers.get('content-type') || 'image/jpeg';
    if (!mimeType.startsWith('image/')) throw new Error('Image service did not return an image');
    const base64 = Buffer.from(await resp.arrayBuffer()).toString('base64');
    return { mimeType, base64 };
  } finally {
    clearTimeout(timer);
  }
}

app.post('/api/chat', async (req, res) => {
  const ip = req.ip;
  if (isRateLimited(ip)) {
    return res.status(429).json({ error: 'Too many requests. Please slow down.' });
  }

  const { messages } = req.body;
  if (!Array.isArray(messages) || messages.length === 0) {
    return res.status(400).json({ error: 'messages array is required' });
  }

  const trimmed = messages.slice(-20).map((m) => ({
    role: m.role === 'assistant' ? 'assistant' : 'user',
    content: String(m.content || '').slice(0, 4000),
  }));
  const latest = trimmed[trimmed.length - 1];

  // ---- Image generation path ----
  if (latest.role === 'user' && looksLikeImageRequest(latest.content)) {
    try {
      const { mimeType, base64 } = await generateImage(latest.content);
      return res.json({
        reply: "Here's what I came up with!",
        image: `data:${mimeType};base64,${base64}`,
      });
    } catch (err) {
      console.error('Image generation error:', err.message);
      return res.json({
        reply: "I couldn't make that image right now. The free image service is busy or limits how fast I can ask. Please try again in about 15 seconds!",
      });
    }
  }

  // ---- Normal text chat path ----
  try {
    const model = genAI.getGenerativeModel({ model: TEXT_MODEL, systemInstruction: SYSTEM_PROMPT });
    const history = trimmed.slice(0, -1).map((m) => ({
      role: m.role === 'assistant' ? 'model' : 'user',
      parts: [{ text: m.content }],
    }));
    const chat = model.startChat({ history, generationConfig: { temperature: 0.7, maxOutputTokens: 600 } });
    const result = await chat.sendMessage(latest.content);
    res.json({ reply: result.response.text() || '' });
  } catch (err) {
    console.error('Gemini API error:', err.message);
    res.status(500).json({ error: 'The assistant is temporarily unavailable. Please try again.' });
  }
});

app.get('/health', (req, res) => res.json({ status: 'ok' }));

app.listen(PORT, () => {
  console.log(`Chatbot server running at http://localhost:${PORT}`);
});

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
const SYSTEM_PROMPT = `You are a helpful assistant embedded on a company website.
Be friendly, concise, and accurate. If you don't know something, say so honestly
instead of guessing. Keep answers focused on what the visitor is asking.`;

const MODEL = process.env.GEMINI_MODEL || 'gemini-1.5-flash';

app.use(cors());
app.use(express.json({ limit: '1mb' }));
app.use(express.static('public'));

// Very simple in-memory rate limiting per IP (resets on restart).
// For production, replace with a proper store like Redis.
const requestLog = new Map();
const RATE_LIMIT = 20; // requests
const RATE_WINDOW_MS = 60 * 1000; // per minute

function isRateLimited(ip) {
  const now = Date.now();
  const entry = requestLog.get(ip) || [];
  const recent = entry.filter((t) => now - t < RATE_WINDOW_MS);
  recent.push(now);
  requestLog.set(ip, recent);
  return recent.length > RATE_LIMIT;
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

  // Only keep the last 20 turns to bound cost/context size.
  const trimmed = messages.slice(-20).map((m) => ({
    role: m.role === 'assistant' ? 'assistant' : 'user',
    content: String(m.content || '').slice(0, 4000),
  }));

  try {
    const model = genAI.getGenerativeModel({ model: MODEL, systemInstruction: SYSTEM_PROMPT });

    // Gemini expects roles as "user"/"model", and history separate from the latest message.
    const history = trimmed.slice(0, -1).map((m) => ({
      role: m.role === 'assistant' ? 'model' : 'user',
      parts: [{ text: m.content }],
    }));
    const latest = trimmed[trimmed.length - 1];

    const chat = model.startChat({ history, generationConfig: { temperature: 0.7, maxOutputTokens: 600 } });
    const result = await chat.sendMessage(latest.content);
    const reply = result.response.text() || '';
    res.json({ reply });
  } catch (err) {
    console.error('Gemini API error:', err.message);
    res.status(500).json({ error: 'The assistant is temporarily unavailable. Please try again.' });
  }
});

app.get('/health', (req, res) => res.json({ status: 'ok' }));

app.listen(PORT, () => {
  console.log(`Chatbot server running at http://localhost:${PORT}`);
});